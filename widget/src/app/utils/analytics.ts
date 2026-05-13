/**
 * Analytics — fire-and-forget event client.
 *
 * All events POST to the `widget-events` edge function. Failures are logged
 * but never thrown — the widget must keep working if the dashboard is unreachable.
 *
 * Conversation/message/ticket endpoints are wired here as helpers but the
 * real conversation lifecycle endpoints are still TODO; this file currently
 * routes them through `widget-events` with a `type` discriminator so the
 * dashboard can ingest them as raw events until dedicated endpoints exist.
 */

import { FUNCTIONS_BASE, SUPABASE_URL, SUPABASE_ANON_KEY, getStoreContext } from "../config/supabase";

function post(route: string, body: unknown): void {
  try {
    fetch(`${FUNCTIONS_BASE}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch((err) => console.log(`[FuqahChat] POST ${route} failed:`, err));
  } catch (err) {
    console.log(`[FuqahChat] POST ${route} threw:`, err);
  }
}

export interface EventContext {
  storeId: string; // tenant_id
  conversationId: string;
  ticketId?: string;
}

export interface EventPayload {
  [key: string]: unknown;
}

export function trackEvent(type: string, ctx: EventContext, payload?: EventPayload): void {
  const sc = getStoreContext();
  post("/widget-events", {
    event: type,
    tenant_id: ctx.storeId || sc.tenant_id,
    platform: sc.platform,
    store_id: sc.store_id,
    conversation_id: ctx.conversationId,
    ticket_id: ctx.ticketId,
    payload: payload ?? {},
    ts: new Date().toISOString(),
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    tz:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
  });
}

export function startConversation(ctx: EventContext): void {
  trackEvent("conversation.start", ctx, { startedAt: new Date().toISOString() });
}

export interface PostMessageBody {
  messageId: string;
  sender: "customer" | "store";
  text?: string;
  attachment?: { type: "image" | "file"; name: string; url: string; size?: number };
  timestamp: string;
}

export function postMessage(ctx: EventContext, body: PostMessageBody): void {
  trackEvent("message", ctx, body as unknown as EventPayload);
}

export function postFeedback(
  ctx: EventContext,
  messageId: string,
  feedback: "up" | "down" | null,
): void {
  trackEvent("message.feedback", ctx, { messageId, feedback });
}

export function closeConversation(
  ctx: EventContext,
  reason: "manual" | "ai" | "inactivity" | "rating_skip",
): void {
  trackEvent("conversation.closed", ctx, { reason });
}

export function postRating(
  ctx: EventContext,
  rating: { stars: number; comment?: string },
): void {
  trackEvent("rating.submitted", ctx, rating);
}

export function postTicket(
  ctx: EventContext,
  ticket: { subject: string; phone?: string; message?: string },
): void {
  trackEvent("ticket.created", ctx, ticket);

  // Best-effort real insert into tickets_main so the merchant dashboard
  // shows widget-raised tickets. Requires a resolved tenant_id (set by
  // widget-loader after widget-resolve) — without it the row would fail RLS.
  const storeCtx = getStoreContext();
  const tenantId = storeCtx.tenant_id;
  if (!tenantId) {
    console.log("[FuqahChat] postTicket skipped: no tenant_id resolved");
    return;
  }
  const subject = ticket.subject || ticket.message || "New ticket from chat";
  fetch(`${SUPABASE_URL}/rest/v1/tickets_main`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      conversation_id: ctx.conversationId ?? null,
      subject: subject.slice(0, 200),
      description: ticket.message ?? null,
      status: "open",
      priority: "medium",
      customer_phone: ticket.phone ?? null,
    }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.log("[FuqahChat] tickets insert failed", r.status, txt);
      }
    })
    .catch((err) => console.log("[FuqahChat] tickets insert threw:", err));
}
