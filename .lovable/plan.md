## Goal

Make the dashboard's "اختبار المحادثة" (Test Chat) page send real messages through the exact same `chat-ai` Supabase edge function the widget uses, so the merchant can actually test their AI and every word is deducted from their monthly quota — but the resulting conversation must NOT appear in the merchant's Conversations page.

## Changes

### 1. Database (migration)
Add an `is_test` flag to `conversations_main` so word-usage accounting still runs (via the existing `bump_word_usage` trigger on `conversations_messages`) while we can hide test rows from the Conversations UI.

- `ALTER TABLE conversations_main ADD COLUMN is_test boolean NOT NULL DEFAULT false`
- Index on `(tenant_id, is_test)` to keep the filtered list query fast.

### 2. Edge function `supabase/functions/chat-ai/index.ts`
- Accept an optional `is_test: boolean` in the request body.
- When `is_test === true`:
  - Skip the per-minute rate-limit check (merchant testing their own AI shouldn't be throttled).
  - When inserting/upserting `conversations_main`, set `is_test = true` and `channel_kind = 'web'`.
  - Everything else stays identical (n8n webhook call, message persistence → word-usage trigger fires → quota deducted, classifier logging, etc.).
- No new webhook — the exact same `N8N_WEBHOOK_URL` secret is used.

### 3. Frontend — `src/app/components/settings/TestChat.tsx`
Replace the canned `aiResponses` mock with a real call to the edge function:
- Import `supabase` client and read `tenantId` from `AppContext`.
- Maintain a stable `conversationId` (UUID) for the test session, persisted to localStorage alongside messages so refreshes keep the same thread.
- On send:
  - Optimistically push the user message + a typing indicator.
  - Call `supabase.functions.invoke('chat-ai', { body: { tenant_id, conversation_id, visitor_id: 'test-<tenantId>', message, history, is_test: true } })`.
  - Replace the typing indicator with `data.reply`. Handle `rate_limited` (shouldn't happen now), `402` credit/quota messages, and network errors with a clear inline error bubble.
- "Clear Chat" also rotates the `conversationId` so a new test thread starts fresh.
- Keep the orange warning banner; it is now accurate.

### 4. Hide test conversations from Conversations page
- `src/app/components/ConversationsPage.tsx` (and any related service in `src/app/services/metrics.ts` / list query): add `.eq('is_test', false)` to the conversations list query so test threads don't pollute the merchant's real inbox.
- Dashboard metrics that count conversations should also exclude `is_test = true` to avoid inflating KPIs from testing.

## Technical notes
- Word deduction continues to work automatically: `conversations_messages` inserts (sender = customer and sender = ai) fire the existing `bump_word_usage` trigger, which updates `settings_plans.monthly_words_used` and `dashboard_usage_daily.ai_words_used`. No extra accounting code needed.
- Same webhook = same n8n agent, same merchant context loaded (training prompt, store info, products) → the test behaves identically to a real visitor.
- Test convos still create rows in `conversations_main` / `conversations_messages` (required for the trigger and for the AI to have history), they are simply filtered out of the UI by `is_test = false`.
