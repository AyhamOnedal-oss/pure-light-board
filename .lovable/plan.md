## Why conversations stay open

I traced every "close" path from the widget through to `conversations_main`. The reason most chats never flip to `closed` (and therefore never get classified — `classify-conversation` only runs from the post‑resolve trigger) is that the **only** moments the row is updated to `status='closed'` today are:

1. User explicitly clicks the X / "إنهاء المحادثة" (`closeConversation(evCtx, 'manual')`).
2. User picks "No" on a quick reply.
3. Inactivity timer reaches the close step **while the widget is open**.
4. Rating submit / skip.
5. `chat-ai` detects the user themselves said goodbye (`userIntent === "end_conversation"`).

Everything else — the AI saying farewell, the customer just closing the tab, the bubble being minimised — leaves the row at `status='new'` forever. That matches the data: closed rows in `conversations_main` are the rare cases where one of the 5 triggers above ran; everything else (including the conversation in the screenshot, which ends with the AI's farewell "شكراً لتواصلك معنا 🌷") stays `new`.

There are also two smaller bugs amplifying it:

- `chat-ai` returns `intent: "closed"` and `action.type: "offer_close_done"` after it auto‑closes on user `end_conversation`, but the widget's `chatApi`/`ChatWindow` ignore both. The DB is closed, but the widget keeps the chat alive, never shows rating, and the customer can keep typing into a "closed" row.
- `closeConversation` events use `fetch(..., { keepalive: true })` with no retry. When the tab is being closed at the same time (which is exactly when "manual" / page-unload closes fire), these silently fail and the DB never sees them.
- The inactivity countdown stops the moment the user minimises the widget back to the bubble — so any real-world abandonment never reaches step 3.

## Plan

### 1. Treat the AI farewell as a real close (server side)
In `supabase/functions/chat-ai/index.ts`, when the decided `action.type === "offer_close"` (AI is wrapping up), also update `conversations_main` with:
- `status = 'closed'`
- `close_reason = 'ai_offer_close'`
- `resolved_at = now()`

…and return `intent: "closed"` so the widget can react. Keep the existing `user_end_conversation` branch as-is. This makes the post-resolve `classify-conversation` trigger fire for every naturally-ended chat, not just the ones where the user typed "شكراً، خلاص".

### 2. Auto-close on customer abandonment (server side, safety net)
Add a tiny scheduled edge function `auto-close-stale-conversations` (or extend an existing cron) that every 5 min runs:
```
UPDATE conversations_main
SET status='closed', close_reason='idle', resolved_at=now(), updated_at=now()
WHERE status IN ('new','open','pending')
  AND updated_at < now() - interval '15 minutes';
```
This is the only reliable way to close tab-closed / minimised chats, and it guarantees classify runs on them. Threshold (15 min) configurable per tenant later; hard-code for now.

### 3. Widget reacts to `intent: "closed"` from chat-ai
In `widget/src/app/utils/chatApi.ts`, surface `intent` on the result. In `ChatWindow.tsx`, after rendering the AI reply, if `result.intent === 'closed'`:
- Stop input (set `currentScreen = 'rating'`).
- Don't re-send a `conversation.closed` event (server already closed). Just `trackEvent('conversation.closed_by_ai', evCtx)` for telemetry.

### 4. Make widget closes durable
In `widget/src/app/utils/analytics.ts`:
- For `conversation.closed` specifically, use `navigator.sendBeacon` (with JSON Blob) when available, falling back to `fetch keepalive`. Beacon is what survives tab close.
- Add a one-shot retry on the fetch fallback if it rejects.

### 5. Keep inactivity timer running when bubble is minimised
In `ChatWindow.tsx`, the inactivity effect bails when `currentScreen !== 'chat'`. Also bail today when widget is collapsed because the component unmounts. Lift a lightweight "last activity at" timestamp to `ChatWidget` (parent) and keep the inactivity timer there, so a minimised but still-loaded widget can still fire `closeConversation(evCtx, 'inactivity')` after `promptSeconds + closeSeconds`. (Step 2's server-side cron is the real safety net; this just makes telemetry accurate.)

### 6. Verify
- Open widget, let AI send farewell → row should flip to `closed` with `close_reason='ai_offer_close'` within a second; `classify-conversation` should run.
- Open widget, send one message, close the tab → within ~15 min the cron should close the row.
- Reload `/dashboard/conversations` and confirm the badge changes from "مفتوحة" to "مغلقة" and AI classification labels appear on previously-stuck conversations.

### Files touched

- `supabase/functions/chat-ai/index.ts` — auto-close on `offer_close`.
- `supabase/functions/auto-close-stale-conversations/index.ts` — new cron-style function.
- `supabase/config.toml` — schedule the new function (or wire via pg_cron in a migration; will pick the simpler one when building).
- `widget/src/app/utils/chatApi.ts` — expose `intent`.
- `widget/src/app/utils/analytics.ts` — sendBeacon + retry for `conversation.closed`.
- `widget/src/app/components/ChatWindow.tsx` — react to `intent==='closed'`.
- `widget/src/app/components/ChatWidget.tsx` — lift inactivity timer so it survives minimise.

### Out of scope (flag, don't change)

- Why `classify-conversation` may have failed on the few already-closed rows — separate investigation; I'll check its logs after step 1–2 produce a fresh batch of closed rows.
- Changing the inactivity thresholds — keeping current defaults (90s prompt / 60s close).