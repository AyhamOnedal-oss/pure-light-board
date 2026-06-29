## Context: What the two widgets actually show today

**حالة الخوادم (Server Status)** — already real.
- Source: `public.admin_health_checks`, written by the `health-check` edge function which pings Supabase, Hostinger, Resend, and OpenAI and records `status` (`up`/`degraded`/`down`), `error`, and `checked_at` per provider.
- UI: green = متصل, amber = تقريباً متصل, red = غير متصل. Defaults to "up" if no row exists for a provider.
- No change requested.

**المشتركون الجدد عبر الوقت (New Subscribers Over Time)** — currently NOT live.
- Source today: static `admin_dash_new_subs_monthly` seed table.
- Does not filter for paid plans.

## Changes

### 1. Remove the up/down arrows on the 6 KPI cards
File: `src/app/components/admin/AdminDashboard.tsx`
- Delete the `<TrendingUp />` / `<TrendingDown />` block (~lines 400–405) and the `change %` text next to it.
- Drop unused imports `TrendingUp`, `TrendingDown`.
- Keep `AnimatedValue` and the KPI number itself.

### 2. Make "New Subscribers Over Time" live, paid-only, current calendar year, deduped by store

Definition of "paid": tenant whose `settings_workspace.plan` is one of `economy`, `basic`, `professional`, `business`, `pro` (same list used for Uninstalls).

**Dedup key:** the platform's own store identifier, not `tenant_id`.
- Zid: `zid_connections.store_uuid` (permanent across uninstall → reinstall, regardless of which Fuqah workspace the merchant logs into).
- Salla: `salla_connections.store_id`.
- Fallback: use `tenant_id` when the store ID is null (defensive; shouldn't happen for real installs).

**New SQL RPC** `public.admin_new_subs_monthly(_year int default extract(year from now() at time zone 'Asia/Riyadh')::int)` returning `{ month int, platform text, count int }`:

1. CTE `paid_tenants` = `settings_workspace.id` where `plan IN ('economy','basic','professional','business','pro')`.
2. CTE `zid_first` = for each `coalesce(store_uuid, tenant_id::text)`, the `min(created_at)` from `zid_connections` rows whose `tenant_id` is in `paid_tenants`.
3. CTE `salla_first` = same for `salla_connections` keyed on `coalesce(store_id, tenant_id::text)`.
4. Restrict each row to `extract(year from min_created_at at time zone 'Asia/Riyadh') = _year`.
5. Group by `month` + `platform`; zero-fill the 12 months with `generate_series(1,12)` × `('zid','salla')`.
6. `SECURITY DEFINER`, gated by `admin_has_permission(auth.uid(), 'admin_dashboard')`.

So a store that was installed in Feb, uninstalled, then reinstalled in Aug counts as **1 install in Feb** — it is not double-counted, and reinstalls do not show as new subscribers.

**Frontend wiring** in `src/app/services/adminDashboard.ts`:
- Replace the `admin_dash_new_subs_monthly` table read with `supabase.rpc('admin_new_subs_monthly', { _year: new Date().getFullYear() })`.
- Keep the existing `NewSubsMonthly` shape so `AdminDashboard.tsx` keeps working unchanged.

### Out of scope
- Server Status widget (already real).
- KPI values themselves — only the arrow/percent removal.
- The seed table `admin_dash_new_subs_monthly` is left in place but unused by this chart.

## Technical notes

- A merchant who reinstalls under a different Fuqah workspace would still count once, because the platform `store_uuid`/`store_id` is the same.
- Paid-plan list lives in one CTE so changing the tier list later requires editing one place.
- All time bucketing uses Asia/Riyadh so "this year" matches the dashboard's locale.
