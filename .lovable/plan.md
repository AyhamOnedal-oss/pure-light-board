# Admin Dashboard KPI redefinitions

Rewrite the `admin_kpis` RPC so the top cards reflect real merchant data instead of `auth.users`. No UI restructure — only labels, numbers, and the RPC behind them change.

## 1. إجمالي العملاء (Total Customers)

**New definition:** distinct `tenant_id` that appears in `zid_connections` ∪ `salla_connections`. Employees, admin staff, and bare `auth.users` rows no longer count.

```sql
SELECT count(*) FROM (
  SELECT tenant_id FROM public.zid_connections
  UNION
  SELECT tenant_id FROM public.salla_connections
) t;
```

Date range (when provided) filters on `created_at` of the connection row.

## 2. عملاء غير مكتملين  (rename from "غير نشطين")

Rename label everywhere in `AdminDashboard.tsx` from "العملاء غير النشطين" → "العملاء غير المكتملين" (English fallback: "Incomplete Customers").

**New definition:** union of the 4 sources, deduped by lowercased email + digits-only phone:

| # | Source | Condition |
|---|--------|-----------|
| A | `admin_landing_leads` | `match_status <> 'full'` (lead, contacted, declined) |
| B | `settings_workspace` + `settings_plans` | `plan IN ('free','trial')` AND trial expired (`period_start + 14 days < now()` or no active connection) |
| C | `settings_workspace` | `plan IN ('free','trial')` AND still inside trial window |
| D | `zid_connections`/`salla_connections` | connection exists AND `settings_workspace.plan IN ('free','trial')` AND tenant has never had a paid plan event |

Dedup key: `coalesce(lower(email),'') || '|' || regexp_replace(coalesce(phone,''),'\D','','g')`. Records with no email and no phone count once each.

Cancelled subscriptions are excluded (those belong to the uninstalls KPI).

## 3. إلغاء التثبيت (Total Uninstalls)

**New definition:** count of uninstall webhook events from real paid customers only.

- Zid: rows in `zid_events` where `event_type IN ('app.uninstalled','uninstall')`.
- Salla: rows in `salla_events` where `event_type = 'app.uninstalled'`.
- Filter: only include events for tenants whose `settings_workspace.plan IN ('economy','basic','professional','business')` (or whose `settings_plans.monthly_word_quota` exceeds the trial default). Trial uninstalls are excluded per the user's rule.
- Date range filters on `event.created_at`.

Comparison (`prev_total_uninstalls`) uses the same shifted window logic already in `admin_kpis`.

## 4. Other KPI cards

Untouched in this change: `total_bubble_clicks`, `avg_response_seconds`, `active_customers`. They keep the current formula.

## Files to change

1. **Migration** — replace `public.admin_kpis(_from, _to)`:
   - Rewrite `v_total` query to use the connections union.
   - Replace the `v_uninstalls` query with the events-table count filtered by paid plan.
   - Add `v_incomplete` + `v_prev_incomplete` computed via the 4-source union with the dedup key above.
   - Extend the returned JSON with `incomplete_customers` + `prev_incomplete_customers`.
   - Keep existing keys for backwards compatibility, but `inactive_customers` now mirrors `incomplete_customers` so old code still renders.

2. **`src/app/services/adminDashboard.ts`**
   - Add `incomplete_customers` + `prev_incomplete_customers` to `AdminKpis`.
   - Leave mock fallback in place but stop reading `inactive_customers_change` semantics for the new card.

3. **`src/app/components/admin/AdminDashboard.tsx`**
   - Rename the card label from "العملاء غير النشطين" / "Inactive Customers" to "العملاء غير المكتملين" / "Incomplete Customers".
   - Bind that card's value to `incomplete_customers` (with `inactive_customers` fallback for the mock state).
   - Bind `total_customers` and `total_uninstalls` to the new RPC values (already wired — verify no client-side overrides remain).

## Technical notes

- The dedup union for "incomplete" runs entirely inside the RPC (one `WITH` CTE per source, then `SELECT count(DISTINCT key)`) to avoid extra round-trips.
- Paid-plan detection lives in a single CTE so steps 2 and 3 share the same definition; changing the paid-tier list later requires editing one place.
- `zid_events` / `salla_events` already exist and are written by the OAuth webhooks today, so no new tables are needed.
- No changes to charts further down the dashboard (`Subscriptions by Platform`, `Customer Source Comparison`, etc.).
