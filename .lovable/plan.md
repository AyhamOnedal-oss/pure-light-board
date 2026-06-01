## Problem

In `widget-4.7.17-hostinger.js`, the multi-line split logic is in place, but only the first line bubble appears for the user. Root cause: the second line is only pushed to `state.messages` *after* the first backend response returns (inside `onDone → next()`). If anything during the first round-trip changes UI state — `intent === 'closed'` triggering `renderRatingScreen()`, `intent === 'offer_ticket'` injecting a ticket form, an error in `pushAiMessage`, a thrown callback, or the user closing — the queue can stop before the second customer bubble is ever rendered. Result: the second line is silently dropped, exactly matching the screenshot.

## Fix (only in `/mnt/documents/widget-4.7.18-hostinger.js`)

1. **Render all customer bubbles immediately**, before any network call. Loop through `lines`, push each as a `customer` message into `state.messages` (attachment only on the first), call `renderMessages()` once. The widget instantly shows every line as its own bubble, matching the dashboard view (each row is a separate `messages` row keyed by `sender='customer'`).
2. **Then send sequentially** to `chat-ai` in a queue, one request per line, so the AI sees them as ordered separate messages and the conversation history stays clean.
3. **Queue resilience**: `next()` always runs after the previous request — both on success and failure — so a single bad response cannot strand the remaining lines. Intent handling (ticket form, closed/rating) only runs for the **last** line's response, not intermediate ones, so the rating/ticket UI does not pop up mid-batch.
4. Keep current input handling (desktop Enter = send, Shift+Enter = newline, mobile Enter = newline). Empty lines from extra blank separators are dropped as before.
5. Bump header to `Version: 4.7.18 (Hostinger embed: render all lines as separate bubbles, then send sequentially)`.
6. No changes to `sendToBackend`, ticket flow, rating flow, dashboard, edge functions, React widget, or any other code path.

## Deliverable

`/mnt/documents/widget-4.7.18-hostinger.js` — the only file to upload to Hostinger. The previous `widget-4.7.17-hostinger.js` stays in place for rollback.

## Out of scope

- No changes to `widget/src/app/components/ChatInput.tsx` (React widget) — that file already splits correctly and is not what Hostinger serves.
- No backend / `chat-ai` / dashboard changes. Dashboard already renders each `messages` row separately, so once the widget sends one row per line the dashboard will show them as separate messages automatically.
