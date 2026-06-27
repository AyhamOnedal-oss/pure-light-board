## Problem

In `/admin/customers/:id`, "نقرات الفقاعة" (bubble clicks) and "تقييم الشات" (chat rating) are wrong — clicks show 0/low and rating shows `0 / 5` — even though the same tenant's user dashboard correctly shows 175 clicks and 3.9 rating.

Two root causes (verified against the live DB):

1. **RLS blocks admin staff.** `dashboard_usage_daily` and `conversations_main` only allow access via `is_tenant_member(...)` / `member_can(...)`. An admin (super_admin or `app_role='admin'`) is not a tenant member of customer workspaces, so every cross-tenant SELECT returns 0 rows. This is the same class of bug we fixed last turn for `auth_tenant_members` / `settings_workspace` / `zid_connections` / `salla_connections` / `settings_plans` — these two tables were missed.

2. **`AdminCustomerDetails` never reads the rating.** In `src/app/components/admin/AdminCustomerDetails.tsx` the load effect hardcodes `rating: 0` — `csat_rating` is never queried from `conversations_main`.

Verified data for the 3 real tenants (so the numbers below are what `/admin/customers/:id` should show):

| Tenant | Clicks | Rating |
|---|---|---|
| المتجر التجريبي النهائي (Zid) | 175 | 3.93 (28 ratings) |
| متجر تجريبي (Salla) | 33 | 3.20 (5) |
| Fuqah AI (Salla) | 48 | 3.82 (11) |

## Fix

### 1. Migration — add admin-read RLS policies

Mirror what we did for the customers list so admin staff can read aggregated metrics across all tenants:

```sql
CREATE POLICY "admins read all usage"
  ON public.dashboard_usage_daily FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins read all conversations"
  ON public.conversations_main FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role));
```

Read-only — no INSERT/UPDATE/DELETE for admins on these tables.

### 2. `src/app/components/admin/AdminCustomerDetails.tsx`

- Add a parallel fetch:
  `supabase.from('conversations_main').select('csat_rating').eq('tenant_id', id).not('csat_rating','is',null)`
- Compute `avgRating = sum/count` (rounded to 1 decimal) and `ratingCount`.
- Replace the hardcoded `rating: 0` with the computed value; show "—" when `ratingCount === 0`.
- Keep `bubbleClicks` query as-is — once RLS is fixed it will return the real sum.

## Out of scope

No UI redesign, no changes to the user dashboard, no other tabs touched.
