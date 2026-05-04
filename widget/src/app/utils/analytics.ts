/**
 * Analytics — Fire-and-forget event client for the Fuqah dashboard backend.
 *
 * All events POST to:
 *   https://<projectId>.supabase.co/functions/v1/make-server-fc841b6e/<route>
 *
 * Failures are logged (console.log) but never thrown — the widget must keep
 * working even if the dashboard is unreachable.
 *
 * Event catalogue (see schema with the dashboard team):
 *   widget.opened / widget.closed
 *   welcome_bubble.shown / welcome_bubble.clicked
 *   message.sent / message.received
 *   attachment.uploaded
 *   message.feedback
 *   ticket.form_shown / ticket.form_submitted / ticket.created
 *   rating.submitted / rating.skipped
 *   inactivity.prompt_shown / inactivity.continued / inactivity.ended
 *   conversation.closed   (reason: manual | ai | inactivity | rating_skip)
 *   chat.exported
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc841b6e`;

function post(route: string, body: unknown): void {
  try {
    fetch(`${BASE}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(err => console.log(`[FuqahChat] analytics POST ${route} failed:`, err));
  } catch (err) {
    console.log(`[FuqahChat] analytics POST ${route} threw:`, err);
  }
}

export interface EventContext {
  storeId: string;
  conversationId: string;
  ticketId?: string;
}

export interface EventPayload {
  [key: string]: unknown;
}

/** Generic event — routed to /events by the dashboard backend. */
export function trackEvent(type: string, ctx: EventContext, payload?: EventPayload): void {
  post('/events', {
    type,
    storeId: ctx.storeId,
    conversationId: ctx.conversationId,
    ticketId: ctx.ticketId,
    payload: payload ?? {},
    ts: new Date().toISOString(),
    // Low-risk diagnostic context (no PII)
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    tz: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
  });
}

/* ─── High-level helpers (mirror dashboard routes) ──────────────────────── */

export function startConversation(ctx: EventContext): void {
  post('/conversations/start', {
    storeId: ctx.storeId,
    conversationId: ctx.conversationId,
    startedAt: new Date().toISOString(),
  });
}

export interface PostMessageBody {
  messageId: string;
  sender: 'customer' | 'store';
  text?: string;
  attachment?: { type: 'image' | 'file'; name: string; url: string; size?: number };
  timestamp: string;
}

export function postMessage(ctx: EventContext, body: PostMessageBody): void {
  post(`/conversations/${encodeURIComponent(ctx.conversationId)}/messages`, {
    storeId: ctx.storeId,
    ...body,
  });
}

export function postFeedback(ctx: EventContext, messageId: string, feedback: 'up' | 'down' | null): void {
  post(`/messages/${encodeURIComponent(messageId)}/feedback`, {
    storeId: ctx.storeId,
    conversationId: ctx.conversationId,
    feedback,
  });
}

export function postTicket(ctx: EventContext, body: {
  phone: string; dialCode: string; source: 'inline' | 'form';
}): void {
  post('/tickets', {
    storeId: ctx.storeId,
    conversationId: ctx.conversationId,
    ticketId: ctx.ticketId,
    ...body,
    createdAt: new Date().toISOString(),
  });
}

export function postRating(ctx: EventContext, body: {
  stars: number; feedback?: string; skipped?: boolean;
}): void {
  post('/ratings', {
    storeId: ctx.storeId,
    conversationId: ctx.conversationId,
    ...body,
    submittedAt: new Date().toISOString(),
  });
}

export function closeConversation(
  ctx: EventContext,
  reason: 'manual' | 'ai' | 'inactivity' | 'rating_skip' | 'rating_submit',
): void {
  post(`/conversations/${encodeURIComponent(ctx.conversationId)}/close`, {
    storeId: ctx.storeId,
    reason,
    closedAt: new Date().toISOString(),
  });
}
