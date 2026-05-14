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
  const tenantId = ctx.storeId || sc.tenant_id;

  // bubble.click / bubble.shown go DIRECTLY into widget_events (live metric).
  // Other events keep going through the legacy edge function for now.
  if ((type === "bubble.click" || type === "bubble.shown") && tenantId) {
    const eventType = type === "bubble.click" ? "widget_open" : "widget_shown";
    try {
      fetch(`${SUPABASE_URL}/rest/v1/widget_events`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          type: eventType,
          conversation_id: ctx.conversationId || null,
          metadata: {
            platform: sc.platform,
            store_id: sc.store_id,
            ...(payload ?? {}),
          },
        }),
        keepalive: true,
      }).catch((err) => console.log(`[FuqahChat] widget_events insert failed:`, err));
    } catch (err) {
      console.log(`[FuqahChat] widget_events insert threw:`, err);
    }
    return;
  }

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

export async function postTicket(
  ctx: EventContext,
  ticket: { subject: string; phone?: string; message?: string },
): Promise<{ ticketId?: string; ticketNumber?: number; displayCode?: string } | null> {
  // Synchronous call so we can return the real ticket number from the backend.
  const sc = getStoreContext();
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/widget-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event: "ticket.created",
        tenant_id: ctx.storeId || sc.tenant_id,
        platform: sc.platform,
        store_id: sc.store_id,
        conversation_id: ctx.conversationId,
        ticket_id: ctx.ticketId,
        payload: ticket,
        ts: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.log("[FuqahChat] postTicket failed:", res.status);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return {
      ticketId: data.ticket_id,
      ticketNumber: data.ticket_number,
      displayCode: data.display_code,
    };
  } catch (err) {
    console.log("[FuqahChat] postTicket threw:", err);
    return null;
  }
}
