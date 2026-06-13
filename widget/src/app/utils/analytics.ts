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

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, getStoreContext } from "../config/supabase";

function post(route: string, body: unknown): void {
  const url = `${FUNCTIONS_BASE}${route}`;
  const payload = JSON.stringify(body);
  // Manual close + rating MUST use authenticated fetch — Supabase function
  // gateway rejects requests without `apikey` even when verify_jwt=false,
  // so sendBeacon (which can't set headers) silently drops them.
  // sendBeacon is reserved for the pagehide/unload fallback, where the
  // caller passes `__beacon: true` in the body.
  const isCloseLike =
    typeof body === "object" &&
    body !== null &&
    (body as { event?: string }).event === "conversation.closed";
  const beaconOnly =
    typeof body === "object" &&
    body !== null &&
    (body as { __beacon?: boolean }).__beacon === true;
  if (beaconOnly && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "text/plain" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch (err) {
      console.log(`[FuqahChat] sendBeacon ${route} failed:`, err);
    }
  }
  try {
    const doFetch = () =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: payload,
        keepalive: true,
      });
    doFetch()
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.log(`[FuqahChat] POST ${route} non-ok`, res.status, txt);
          if (isCloseLike) doFetch().catch(() => {});
        }
      })
      .catch((err) => {
        console.log(`[FuqahChat] POST ${route} failed, retrying:`, err);
        if (isCloseLike) doFetch().catch((err2) => console.log(`[FuqahChat] retry failed:`, err2));
      });
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
  rating: { stars: number; comment?: string; feedback?: string; skipped?: boolean },
): void {
  const raw = rating.comment ?? rating.feedback ?? "";
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  trackEvent("rating.submitted", ctx, {
    stars: rating.stars,
    comment: trimmed.length > 0 ? trimmed : null,
    ...(rating.skipped ? { skipped: true } : {}),
  });
}

export async function postTicket(
  ctx: EventContext,
  ticket: { subject: string; phone?: string; message?: string },
): Promise<{ ticketId?: string; ticketNumber?: number; displayCode?: string } | null> {
  // Synchronous call so we can return the real ticket number from the backend.
  // Retries once on transient network error.
  const sc = getStoreContext();
  const payload = JSON.stringify({
    event: "ticket.created",
    tenant_id: ctx.storeId || sc.tenant_id,
    platform: sc.platform,
    store_id: sc.store_id,
    conversation_id: ctx.conversationId,
    ticket_id: ctx.ticketId,
    payload: ticket,
    ts: new Date().toISOString(),
  });
  const attempt = async () =>
    fetch(`${FUNCTIONS_BASE}/widget-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: payload,
    });
  let res: Response | null = null;
  try {
    res = await attempt();
  } catch (err) {
    console.log("[FuqahChat] postTicket network error, retrying:", err);
    try { res = await attempt(); } catch (err2) {
      console.log("[FuqahChat] postTicket retry failed:", err2);
      return null;
    }
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok || data?.ok === false) {
    console.log("[FuqahChat] postTicket failed:", res.status, data);
    return null;
  }
  return {
    ticketId: data.ticket_id as string | undefined,
    ticketNumber: data.ticket_number as number | undefined,
    displayCode: data.display_code as string | undefined,
  };
}
