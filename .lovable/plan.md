## What I found

- Conversation `7574c956-9cd7-44b1-9f3b-d65b52a1b42e` exists for tenant `c9b3f2cf-bc64-4ea0-8d8e-a0811e413761`.
- It has the expected transcript, including: `عندي اقتراح بطور متجركم بشكل رهيب`.
- It is still `status = new`, with `analysis_done = false`, `category = null`, `intent_type = null`, and `completion_score = null`.
- There is no row in `tickets_main` for this conversation, and no dashboard activity for it.
- The widget currently shows a fake/local ticket number immediately, but ticket creation depends on `widget-events`. That endpoint receives the client conversation id, while `chat-ai` may replace non-UUID conversation ids with a new UUID and the widget never stores that real backend id. That can break ticket linking/creation.
- Classification is only triggered when the conversation becomes `closed` or `resolved`; this conversation never closed in the DB, so the AI analysis never ran.

## Plan

1. Fix the widget conversation ID lifecycle
   - Change `chatApi.sendMessage` to return the backend `conversation_id` from `chat-ai`.
   - Update `FloatingWidget` / `ChatWindow` so after the first AI response, the widget replaces its temporary id with the real UUID returned by the backend.
   - Ensure all future events use that same backend UUID.

2. Fix ticket creation reliability
   - Make ticket submission wait for the backend `widget-events` response instead of showing success unconditionally.
   - Have `widget-events` return the inserted ticket id/number/display code.
   - Update the widget success screen to show the actual backend ticket number, not a random local number.
   - On ticket creation, update the linked `conversations_main.ticket_status = 'open'` so the conversations dashboard shows “Open Ticket”.
   - Insert a `tickets_activities` “created” activity so the ticket detail timeline is populated.

3. Fix conversation closure and AI analysis trigger
   - When a ticket is created from a conversation, mark the conversation as `closed`, set a valid `close_reason`, and let the existing DB trigger call `classify-conversation`.
   - Keep manual/rating/inactivity close flows using valid close reasons only.
   - Remove the unsupported `rating_submit` reason path by mapping it safely to `customer_manual`.

4. Harden AI classification
   - Update the classification prompt to strongly classify Arabic suggestion language like `اقتراح`, `أقترح`, `فكرة`, `تحسين` as `suggestion` unless the transcript clearly asks a question or requests service.
   - Keep analysis post-completion only; do not classify active/open conversations.

5. Validate with the reported conversation
   - After implementation, manually run classification for `7574c956-9cd7-44b1-9f3b-d65b52a1b42e` if it remains unclosed, or close it through the corrected flow.
   - Confirm that a new ticket appears in `tickets_main`, the dashboard can query it, and the conversation has classification plus completion score.

## Technical files likely involved

- `widget/src/app/utils/chatApi.ts`
- `widget/src/app/utils/analytics.ts`
- `widget/src/app/components/FloatingWidget.tsx`
- `widget/src/app/components/ChatWindow.tsx`
- `supabase/functions/widget-events/index.ts`
- `supabase/functions/classify-conversation/index.ts`
- Possible database migration for trigger/policy improvements if existing DB triggers or ticket metadata need adjustment.