# Per-Plan Conversation Limits

Apply a hard conversation cap to every tenant based on their plan, block the widget/test chat once the cap is hit, and let admins top up.

## Caps
- Trial (`trial` / `free` / `""`): **50**
- Economy (`economy`): **250**
- Basic / Asasi (`basic`): **500**
- Professional (`professional` / `pro`): **750**
- Business / Amal (`business`): **1000**

A "conversation" = one `conversations_main` row (non-test) created in the current billing period.

## Database (single migration)

1. Add columns to `public.settings_plans`:
   - `conversation_quota int NOT NULL DEFAULT 50`
   - `conversation_topup int NOT NULL DEFAULT 0` — admin top-ups, preserved across plan syncs, reset on renewal.
   - `conversations_used int NOT NULL DEFAULT 0` — cached counter for cheap enforcement.
2. `plan_default_conversation_quota(plan text) → int` returning the mapping above.
3. Trigger on `settings_workspace` after `plan` change: set `settings_plans.conversation_quota = plan_default_conversation_quota(new.plan)`. Does not touch `conversation_topup`.
4. Trigger on `conversations_main` AFTER INSERT (when `is_test = false`): increment `conversations_used`. AFTER DELETE: decrement, floored at 0.
5. Update `admin_snapshot_subscription` and the trial-renewal path in `admin-subscription-actions` to also reset `conversations_used = 0` and `conversation_topup = 0` on cycle rollover.
6. Backfill: set `conversation_quota` for every existing tenant from current plan; recompute `conversations_used` from `conversations_main` since `period_start`.

## Enforcement — `supabase/functions/chat-ai/index.ts`
- Before persisting a NEW conversation (when `isUuid === false`, i.e. first message), read `settings_plans` and check `conversations_used >= conversation_quota + conversation_topup`.
- If over cap: return `{ error: "quota_exceeded", reply: <AR/EN message: "تم الوصول إلى الحد الأقصى للمحادثات لهذه الفترة" >, action: { type: "none" } }` with HTTP 200 so the widget renders it. Also set `intent: "closed"` so the widget doesn't keep prompting.
- Skip the check for `is_test = true` merchant test-chat (test chats already excluded from the counter via `is_test`).

## Admin top-up — `supabase/functions/admin-subscription-actions/index.ts`
- Rename `add_words` handler behavior to top up conversations:
  - Accept `{ action: "add_conversations", conversations: number }`. Keep `add_words` as an alias that treats `words` as conversations for backward compat with any inflight UI, but the UI switches to the new field.
  - Increment `settings_plans.conversation_topup` by the amount, log to `admin_credit_topups` (repurpose `words` column to store the value; add a note like `"unit: conversations"`).

## Frontend
- `src/app/components/settings/PlansPage.tsx`: read `conversation_quota + conversation_topup` and `conversations_used` directly from `settings_plans`. Drop `wordsToConversationsQuota`/token-derived usage.
- `src/app/components/admin/AdminCustomerDetails.tsx` (top-up dialog): change label from "كلمات" to "محادثات", send `{ action: "add_conversations", conversations }`.
- `src/app/utils/conversations.ts`: keep `tokensToConversations` (still used for token analytics) but stop using it for quota display.

## Out of scope
- No pricing/copy changes on the marketing page.
- Word/token analytics remain untouched.

## Technical notes
- All new columns have safe defaults so existing rows work immediately.
- Counter uses a trigger, not a live `count(*)`, to keep the chat hot path a single-row read.
- Quota reset is centralized in the existing renewal/snapshot code paths — no new scheduler.
