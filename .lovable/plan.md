## Issues to fix

### 1) Conversation reference format in Tickets header
Conversations page shows `c.id.slice(0, 8)` (e.g. `39486345`). Tickets page currently shows `CV-XXXXXX`. Make them match.

- `src/app/components/TicketsPage.tsx`: change `conversationDisplayCode` fallback to `r.conversation_id.slice(0, 8)` (no prefix), so users see the same token in both views.

### 2) Long unbroken text overflows the bubble + widget newlines not preserved
Both pages render bubble text as `<div className="px-4 py-3">{msg.text}</div>` — no `break-words`, no `whitespace-pre-wrap`. Long URLs / unbroken strings overflow the bubble and any `\n` from the widget collapses to a space.

- `src/app/components/ConversationsPage.tsx` (bubble line ~504): add `whitespace-pre-wrap break-words`.
- `src/app/components/TicketsPage.tsx` (equivalent bubble): same classes.

Result: URLs wrap inside the bubble, multi-line widget messages render with their original line breaks.

### 3) Thumbs up/down never show on AI messages (dashboard + tickets + homepage chart)
Root cause: the widget posts `event: 'message.feedback'` to `widget-events`, but **that function has no handler for `message.feedback`** — the event is silently dropped. So `conversations_messages.feedback` stays NULL for everything coming from the widget, which means:
- No thumbs render under AI bubbles in Conversations / Tickets.
- `dashboard_metrics().feedback` returns `{positive:0, negative:0}` → pie chart shows "No feedback in this period", AI Message Feedback panel shows "No AI feedback yet".

There's also a mapping gap: the widget generates its own client-side message id, but `chat-ai` inserts the AI message with a fresh DB UUID, so even with a handler there'd be no row to update.

Fix (end-to-end):
1. **`supabase/functions/chat-ai/index.ts`** — when inserting the AI message into `conversations_messages`, capture the inserted row's `id` and return it in the response as `ai_message_id`.
2. **`widget/src/app/utils/chatApi.ts`** — add `aiMessageId?: string` to `SendMessageResult` and pass it through from the chat-ai response.
3. **`widget/src/app/components/ChatWindow.tsx`** — use `result.aiMessageId` (when present) as the AI message's `id` instead of the locally generated one, so the id stored client-side matches the DB row.
4. **`supabase/functions/widget-events/index.ts`** — add a handler for `event === 'message.feedback'`:
   - Map widget's `'up'|'down'` → DB enum `'positive'|'negative'`.
   - `UPDATE conversations_messages SET feedback = ... WHERE id = payload.messageId AND tenant_id = tenant_id`.
   - No-op if `null` (toggle off).

No schema change required (the column already exists).

### 4) Homepage chart shows zero evaluated conversations / no thumbs
Same root cause as #3. Once feedback persists, `dashboard_metrics()` will return real counts and the existing pie + AI Message Feedback panel on `DashboardPage` will populate without further changes. The Conversations realtime subscription added earlier will already refresh the list view; the dashboard refreshes on its own date-range effect.

## Files touched
- `src/app/components/ConversationsPage.tsx` — bubble wrap classes only.
- `src/app/components/TicketsPage.tsx` — bubble wrap classes + change `conversationDisplayCode` fallback.
- `supabase/functions/chat-ai/index.ts` — return inserted AI message id.
- `supabase/functions/widget-events/index.ts` — handle `message.feedback`.
- `widget/src/app/utils/chatApi.ts` — surface `aiMessageId`.
- `widget/src/app/components/ChatWindow.tsx` — adopt the DB id for the AI message.

## Out of scope
- Backfilling feedback for past widget messages (no client message id was stored). Only new messages from now on will be evaluable.
- Changing the dashboard pie chart visuals — they already exist; they just had no data.
