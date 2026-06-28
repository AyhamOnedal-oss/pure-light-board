# Activity Log (سجل النشاط) – real events

Goal: replace the empty `activity: []` array in `AdminCustomerDetails.tsx` with real, per-tenant events for:
1. **ترقية** – plan upgrade / change
2. **تنبيه استنفاد الكلمات - 80%** – when usage crosses 80% of the monthly quota
3. **تم تجديد الاشتراك** – resubscribe / renew trial
4. **{{firstName}} دخل كعميل** – admin/super-admin impersonation, prefixed with the staff member's first name in Arabic (e.g. "فارس دخل كعميل")

## Data model

Create one unified table `public.admin_activity_events` (RLS: admins read all; service role writes):
- `tenant_id uuid`
- `event_type text` — `plan_change` | `usage_80` | `resubscribe` | `impersonation`
- `actor_user_id uuid` (nullable) — staff who triggered it
- `actor_name text` (nullable) — snapshot of staff full name at time of event
- `metadata jsonb` — `{ from_plan, to_plan, words_used, quota, ... }`
- standard `id`, `created_at`

GRANTs + RLS:
- `GRANT SELECT, INSERT ON public.admin_activity_events TO authenticated; GRANT ALL TO service_role;`
- Policy: admins/super_admins can SELECT all rows; INSERTs only via service role / edge functions.

## Writers

- `supabase/functions/admin-impersonate/index.ts` – after the existing `admin_impersonation_log` insert, also insert an `impersonation` event with `actor_user_id = adminUserId` and `actor_name` resolved from `admin_team_members.full_name` (fallback to `auth.users.email` local-part).
- `supabase/functions/admin-subscription-actions/index.ts`:
  - `end` → no activity event (subscription ended; not requested).
  - `add_words` → keep current `admin_credit_topups` insert; no activity row needed.
  - `renew_trial` → also insert a `resubscribe` event.
- **Plan change detection**: add a trigger `on settings_workspace` (and `settings_plans` for paid plan changes) that, when `plan` column changes to a different non-empty value, inserts a `plan_change` event with `from_plan`/`to_plan`.
- **80% usage**: add a trigger on `settings_plans` `AFTER UPDATE` that compares `monthly_words_used / monthly_word_quota` before/after the row update. If it crosses ≥0.80 within the current `period_start` and no `usage_80` event exists for the same `period_start`, insert one. Triggers are simpler and reliable since `settings_plans.monthly_words_used` is updated on every billing tick.

## Reader (frontend)

In `AdminCustomerDetails.tsx` `loadCustomer`:
- Add a Supabase query: `from('admin_activity_events').select('*').eq('tenant_id', id).order('created_at', { ascending: false }).limit(50)`.
- Map rows into the existing `activity[]` shape with localized strings:
  - `plan_change` → en `Upgrade to {to_plan}` / ar `ترقية إلى {to_plan_ar}` – type `success` (green check).
  - `usage_80` → en `Word usage alert - 80%` / ar `تنبيه استنفاد الكلمات - 80%` – type `alert` (yellow clock).
  - `resubscribe` → en `Subscription renewed` / ar `تم تجديد الاشتراك` – type `success`.
  - `impersonation` → en `{firstName} logged in as customer` / ar `{firstName} دخل كعميل` – type `admin` (blue login icon). `firstName` = first whitespace-split token of `actor_name`.
- Format `date` as `HH:mm YYYY-MM-DD` to match the screenshot.

No UI/markup changes — the existing activity tab already renders this shape; only `customer.activity` is now populated.

## Out of scope

- Backfilling historical events before this migration ships.
- Adding new event types beyond the four requested.
