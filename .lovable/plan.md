## What I found

- Latest conversation row: `e3961313-e206-4f16-996a-28e1fa85a651`
- Current DB state: `status = new`, `close_reason = null`, `resolved_at = null`, `csat_rating = null`
- `widget_events` table is empty, and Supabase edge logs show no `widget-events` call for `conversation.closed` or `rating.submitted`.
- So this is not idle/auto-close. The manual close/rating request is not reaching the backend.

## Root cause to fix

There are two likely failures in the current runtime path:

1. The widget can start with a temporary `conv_...` id, then `chat-ai` returns the real DB UUID. Close/rating can still fire with the wrong/stale id in some paths.
2. Close uses `sendBeacon` without auth headers. Even with `verify_jwt=false`, this can be unreliable through Supabase function routing and gives us no visible failure unless logged.

## Implementation plan

1. **Make close/rating always use the real DB conversation UUID**
   - Keep a `latestConversationIdRef` in the widget/chat runtime.
   - Update it immediately when `chat-ai` returns `conversation_id`.
   - Build close/rating event context from the ref, not only from possibly stale React props/state.

2. **Make manual close/rating reliable and visible**
   - For normal manual close and rating submit, use authenticated `fetch(.../widget-events)` with anon `apikey` + `Authorization` headers.
   - Reserve `sendBeacon` only for page unload/background close fallback.
   - Add minimal console logging when `widget-events` returns non-OK so this is debuggable next time.

3. **Fix `widget-events` parsing for beacon fallback**
   - Accept both JSON requests and `text/plain` beacon bodies.
   - Return useful errors when tenant/conversation resolution fails.
   - Log affected close/rating attempts, including conversation id and update count when possible.

4. **Patch the generated standalone widget file too**
   - Regenerate the `/mnt/documents/widget-4.7.25-hostinger.js` patch or create `widget-4.7.26-hostinger.js` with the same real-id + reliable-close changes.
   - This matters because the uploaded/Hostinger 150KB file is likely the code actually running on the store.

5. **Validate**
   - Call `widget-events` directly against the latest conversation id to verify closing works.
   - Check the DB row changes to `closed` with `close_reason='customer_manual'`.
   - Confirm logs now show the close event path.

## Immediate data repair

After code is fixed, I can also mark the current stuck row `e3961313...` as closed so the dashboard stops showing it as open.