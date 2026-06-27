## Problem

`AdminCustomers` is built around `settings_workspace` ("tenants"), then enriched with optional Zid/Salla rows. That's why you saw `Admin's Workspace` and other personal workspaces — every signup auto-creates a `settings_workspace` + `auth_tenant_members` row via the `handle_new_user` trigger, regardless of whether the user ever installed Zid or Salla. None of those are real customers.

Real customers = stores that actually installed the app:

- `zid_connections` → 1 row (`المتجر التجريبي النهائي`)
- `salla_connections` → 2 rows (both `متجر تجريبي`)

Total = 3 customers, matching what you see in the dashboard.

## Fix

Rewrite `fetchAdminCustomers` in `src/app/services/adminCustomers.ts` to be **connection-first**, not workspace-first:

1. Query `zid_connections` and `salla_connections` directly (one row per connection = one customer row).
2. For each connection, look up the linked `settings_workspace` (for `plan`, `status`) and `settings_plans` (for word usage) by `tenant_id` — purely as enrichment, never as the source of truth for whether the row exists.
3. Identity columns come from the connection itself: `store_name`, `store_email`, platform, `is_active` → status (`active` / `inactive`).
4. Drop the `auth_tenant_members` "must have an auth user" filter — it was the wrong proxy and is now unnecessary because the connection itself proves the store is real.
5. Remove the pipeline-derived rows merged in `AdminCustomers.tsx` `combined` (the `pipe_*` entries from `loadCustomers()`) so pipeline mocks like `Noor Fashion` stop appearing in the customer list. Pipeline stays its own screen.
6. Same fix flows naturally to the dashboard "All clients" KPI if it's reading the same service; otherwise leave the dashboard alone since you said it already shows 3.

## Result

The Customers table will show exactly 3 rows (1 Zid + 2 Salla), keyed by `tenant_id`, with working impersonation and details navigation. No personal workspaces, no pipeline mocks.

## Out of scope

- No DB migrations.
- No changes to pipeline, reports, or dashboard logic.
- No UI redesign — same table, same columns, same actions.