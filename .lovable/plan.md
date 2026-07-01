## Root causes

Three real issues in play:

**1. User Dashboard "Conversations Used" is not the real per-tenant counter.**
`src/app/services/metrics.ts` computes `conversationsUsed = tokensToConversations(inputTokens, outputTokens)` from `merchant_token_daily` — a token-based *estimate*, unrelated to the actual quota. So the user dashboard shows 0 while `settings_plans.conversations_used` (what the admin and `chat-ai` enforcement read) sits at 30, 25, 2745, etc.

**2. `settings_plans` rows are not guaranteed to exist for every tenant.**
The `sync_conversation_quota_from_plan` trigger only issues `UPDATE`. If a tenant has no plan row, the UPDATE is a no-op → PlansPage reads null → renders 0 (or the stale "5"). No trigger inserts the row.

**3. Admin customer details still reads legacy `monthly_word_quota / monthly_words_used`.**
That's why admin numbers appear to "count" but disagree with user-side numbers — it's a different column entirely. It also doesn't show input/output tokens next to the conversation count.

## Plan

### Backend — one migration

1. **Guarantee a `settings_plans` row for every workspace.**
   - Backfill: `INSERT INTO settings_plans (tenant_id, conversation_quota) SELECT w.id, plan_default_conversation_quota(w.plan) FROM settings_workspace w LEFT JOIN settings_plans p ON p.tenant_id = w.id WHERE p.tenant_id IS NULL;`
   - New AFTER INSERT trigger on `settings_workspace` → insert matching plan row with correct default quota.
   - Rewrite `sync_conversation_quota_from_plan` to `INSERT … ON CONFLICT (tenant_id) DO UPDATE` so plan changes always land.

2. **Re-sync `conversations_used`** with the same CTE from the original migration so per-tenant counts match reality.

3. **Verify/repair token tracking so 6k in + 300 out shows up on admin.**
   - Confirm `merchant_token_daily` has a UNIQUE key on `(tenant_id, day)` and that inserts from `chat-ai` (and any other AI paths) upsert `input_tokens += ?`, `output_tokens += ?` correctly. If the current code does `.insert()` without upsert, switch to `.upsert(..., { onConflict: 'tenant_id,day' })` with an atomic `+=` via RPC or a small `merchant_token_daily_bump(tenant, in, out)` SECURITY DEFINER function to avoid last-write-wins races.
   - Add that bump function in the same migration.

### Backend — `supabase/functions/chat-ai/index.ts`

4. After a successful model response, call the new `merchant_token_daily_bump(tenant_id, input_tokens, output_tokens)` RPC with the exact usage returned by the provider (do not estimate). This guarantees the 6k/300 example lands in `merchant_token_daily` for that tenant/day.

### Frontend

5. **`src/app/services/metrics.ts`** — Dashboard reads the real counter:
   - Fetch `settings_plans` (`conversation_quota, conversation_topup, conversations_used`) alongside token rows.
   - Return `conversationsUsed = settings_plans.conversations_used` (fallback to token estimate only if the row is missing).
   - Expose `conversationQuota`, `conversationTopup`, `inputTokens`, `outputTokens` on the metrics object.

6. **`src/app/components/DashboardPage.tsx`** — "Conversations Used" KPI shows `used / (quota + topup)` (e.g., `12 / 50`) matching PlansPage exactly.

7. **`src/app/components/settings/PlansPage.tsx`** — defensive local fallback: if fetched `conversation_quota` is 0/null, fall back to the JS mirror of `plan_default_conversation_quota(workspace.plan)` so a missing row never renders `0 / 0` or a stale `5`.

8. **`src/app/components/admin/AdminCustomerDetails.tsx`** — switch source of truth:
   - Read `conversation_quota, conversation_topup, conversations_used` from `settings_plans` (drop `monthly_word_quota/monthly_words_used` reads).
   - Sum `input_tokens` and `output_tokens` for the current period from `merchant_token_daily` and render them alongside the conversation count, e.g.:
     - `المحادثات: 12 / 50 (+0 top-up)`
     - `الرموز المدخلة (input tokens): 6,000`
     - `الرموز المخرجة (output tokens): 300`
   - This makes the 6k/300 example immediately visible when an admin opens the customer.

### Verification

- SQL check: every `settings_workspace.id` has a matching `settings_plans` row with `conversation_quota > 0`.
- Load `/settings/plans` as a trial tenant → shows `X / 50`, never `0 / 5`.
- Load `/` (Dashboard) as same tenant → "Conversations Used" equals PlansPage value.
- Open `/admin/customers/<id>` as admin → same conversation number **plus** input/output tokens for the current period.
- Send a test message that consumes 6,000 input + 300 output tokens → admin view increments input by 6,000, output by 300, conversation count +1 (if it's a new non-test convo).

## Technical notes

- Token bump uses a SECURITY DEFINER RPC so upserts are atomic across concurrent chat-ai invocations (avoids the race where two responses land on the same day/tenant).
- No change to the 50-cap enforcement in `chat-ai` — it already reads the correct column; we're only making that same column visible everywhere.
- Legacy `monthly_word_quota` / `monthly_words_used` columns are left in place to avoid breaking historical reports; only what the UI reads is switched.
