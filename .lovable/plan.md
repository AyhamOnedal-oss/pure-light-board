# Admin Customer Details — Functional Subscription Actions

The buttons in `AdminCustomerDetails.tsx` currently call a fake `handleAction` toast. Make them real, enforce expiry, and add a token usage breakdown.

## 1. Backend (single edge function `admin-subscription-actions`)

New edge function gated by admin role (`admin` / `super_admin` via `auth_user_roles`). Accepts:

- `{ tenantId, action: "end" }`
  - Set `settings_plans.subscription_end_date = today` and `settings_workspace.status = 'inactive'`.
- `{ tenantId, action: "add_words", words }`
  - Increase `settings_plans.monthly_word_quota` by `words` (top‑up). Log entry to `admin_impersonation_log`‑style audit (or new `admin_credit_topups` table — see Tables).
- `{ tenantId, action: "renew_trial" }`
  - Only allowed when current `settings_workspace.plan` is `free`/`trial`. Reset: `monthly_words_used=0`, `period_start=today`, `subscription_end_date=today+14`, `status='trial'`, clear `*_emailed_*` markers. Reject with 400 otherwise.

Login gating (requirement 1 — user can't enter after end date):
- Add a guard in `RequireAuth.tsx` (or `AppContext` bootstrap) that loads the tenant's `settings_plans.subscription_end_date` + `settings_workspace.status`; if `status='inactive'` or `subscription_end_date < today`, route to `AccountDisabledScreen` and block dashboard access. Admin impersonation already uses a separate session, so admins remain unaffected.

## 2. Tables (migration)

- `admin_credit_topups(tenant_id, words, added_by, note, created_at)` with admin‑only RLS + grants for `service_role` and `authenticated` admins. Used for audit + future "previous top‑ups" list.

(No schema changes needed for the actions themselves; existing columns on `settings_plans`/`settings_workspace` cover it.)

## 3. Frontend — `AdminCustomerDetails.tsx`

- Replace `handleAction` stubs for: End Subscription, Add Words, Renew Trial — each invokes `admin-subscription-actions`, then re-fetches the customer data so UI updates immediately (status badge, used %, quota, dates).
- "Renew Trial" button: only enabled when `plan` is `free`/`trial`; otherwise grey out + tooltip "للباقة التجريبية فقط".
- "End Subscription" success: badge flips to ملغي, status shows ended date.
- "Add Words" success: bumps `totalWords`, recomputes %.

## 4. Token / Words Usage Breakdown (Store Info card)

Pull from `ai_classifier_usage` filtered by `tenant_id`:
- `inputTokens = sum(prompt_tokens)`
- `outputTokens = sum(completion_tokens)`
- Scope: only widget context — filter `source IN ('widget','widget_chat')` (verify which `source` value `chat-ai` writes; adjust filter accordingly). Includes image/vision turns since `chat-ai` logs them through the same path.
- Conversion: words = `round(tokens * 0.75)` (standard 1 token ≈ 0.75 word). Display three new tiles next to Trial/Paid/Usage:
  - Input Tokens → words
  - Output Tokens → words
  - Total Tokens → words
- These reflect what is actually deducted from the tenant's quota (matches `monthly_words_used`).

## Technical notes

- Edge function uses `SUPABASE_SERVICE_ROLE_KEY` and verifies caller is admin via `auth_user_roles`.
- `verify_jwt = true` (default) for `admin-subscription-actions`.
- Frontend uses `supabase.functions.invoke('admin-subscription-actions', { body })`.
- After each action call `loadCustomer()` (extracted from the existing `useEffect`) to refresh.
- Login gate query is cheap (1 row) and runs once at auth bootstrap; cache in `AppContext`.

## Out of scope

- Per‑plan paid renewals (Stripe/Paddle flows) — only the trial reset is requested.
- Detailed top‑up history UI (table exists; UI surfacing can come later).
