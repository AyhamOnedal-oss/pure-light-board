
## 1. KPI cards in a single row

`AdminDashboard.tsx`: change the grid from `xl:grid-cols-6` to `xl:grid-cols-7` (there are now 7 cards after adding "Number of Conversations"). All cards stay equal width, one row from `xl` breakpoint down to `sm` (existing responsive stacking preserved).

## 2. Remove the Notes field from the "Edit key" modal

`OpenAIKeysCard.tsx`: remove the `<Field label={Notes}>` input from the modal body. Payload no longer sends `notes` (send `null` to clear). Keep the DB column intact for now; simply stop writing to it.

## 3. Make Key #3 (IQ Test) a real slot like #1/#2

**Data model**
- Add `iqtest` as a third row in `SLOTS`. Row #3 becomes a normal editable row backed by `admin_openai_keys.slot = 'iqtest'` (its own model, input/output prices, project_id).
- Migration: no schema change needed — `admin_openai_keys` already keys by slot text. Just insert a stub row when the admin first hits Edit.

**Cost attribution**
- Update `admin_openai_cost_by_slot()`: `iqtest` cost now comes from `merchant_token_daily` rows where `scope = 'iqtest' AND project_id = <iqtest slot's project>`; falls back to `scope='iqtest'` sum if project not set (backwards compat).
- Update `openai-usage-sync` edge function to look up the iqtest slot's pricing/version when re-costing scope='iqtest' rows (mirrors what it already does for chat/classifier via `admin_openai_active_version`).

**UI**
- Delete the static row #3 markup in `OpenAIKeysCard.tsx`; iqtest is rendered by the same `rows.map(...)` loop as chat/classifier with the same pencil-edit affordance.

## 4. Replace `window.prompt` on OpenAI row with in-app modal + switch to dollar balance

**Concept change**: OpenAI usage bar is now driven by a **dollar balance top-up**, not a word quota. Admin sets e.g. $10.00; each request's `cost_usd` (already tracked in `merchant_token_daily`) is deducted. Bar shows `used$ / balance$`.

**Backend**
- New `admin_settings` key `openai_dollar_balance` (numeric, USD).
- New RPCs:
  - `admin_set_openai_dollar_balance(_amount numeric)` — upserts key. Admin-permission gated.
  - Extend `admin_openai_usage()` to also return `dollar_balance`, `used_usd` (sum `cost_usd` from `merchant_token_daily` this month), `remaining_usd`, `percent_usd`.
- Update `admin-server-usage` edge function's OpenAI section to return `{ balance_usd, used_usd, percent }` alongside the legacy word fields (keep legacy fields for compatibility, mark deprecated).

**Frontend**
- `AdminDashboard.tsx`: replace the `window.prompt` handler with an in-app modal (matching OpenAIKeysCard's modal styling: overlay + confirmation). Fields: **Add balance (USD)** number input with `step="0.01"`, plus a display of current balance and month-to-date consumption. Submit calls the new RPC and refreshes `loadServerUsage()`.
- The OpenAI row in the "Server / Service Usage" card:
  - Label switches from "words this month" to `$X.XX / $Y.YY consumed this month`.
  - Percent bar uses `used_usd / balance_usd`.

## 5. Trial subscription card stays constant on renewal / expiration

Problem: `MerchantConsumptionTable.tsx` computes trial as "rows older than `settings_plans.period_start`". Because `period_start` is bumped each month, the trial figures drift/expand every renewal cycle.

**Fix**
- Migration: add nullable `trial_ended_at timestamptz` column to `settings_plans`. Set it once when the tenant's first paid plan activates (via existing `log_plan_change_event` trigger: if `OLD.plan` was trial/empty and `NEW.plan` is a paid plan and `trial_ended_at IS NULL`, set it to `now()`). Backfill: for tenants already on a paid plan, set `trial_ended_at = COALESCE(first plan_change event ts, tenant created_at + interval '14 days')`.
- `MerchantConsumptionTable.tsx`: fetch `trial_ended_at` alongside `period_start`. Trial bucket = rows where `day < trial_ended_at` (frozen). Current bucket = rows where `day >= period_start`. Analysis/IQ test scoped the same way as trial vs current is decided by whether the row is before `trial_ended_at`.
- Trial conversation count query switches to `.lt('created_at', trialEndedAt)` instead of `.lt('created_at', periodStartIso)`.

## Files touched
- `supabase/migrations/*` (2 migrations: `trial_ended_at` + dollar balance RPCs + updated cost RPC)
- `supabase/functions/openai-usage-sync/index.ts` (iqtest pricing lookup)
- `supabase/functions/admin-server-usage/index.ts` (return dollar fields)
- `src/app/components/admin/AdminDashboard.tsx` (grid cols, dollar-balance modal)
- `src/app/components/admin/OpenAIKeysCard.tsx` (remove Notes field, add iqtest as real slot, drop static row)
- `src/app/components/admin/MerchantConsumptionTable.tsx` (use `trial_ended_at`)
- `src/app/services/adminDashboard.ts` (add `setOpenAiDollarBalance`, extend OpenAI usage type)

## Not changed
- Existing `notes` DB column is left in place (idle) to avoid data loss; UI simply hides it.
- Legacy word-budget RPC (`admin_set_openai_word_budget`) is left for compatibility; the UI stops calling it.
