
# Zid Reports — Database + Sync + Mock Test Suite (final)

## Revenue formula (KSA, confirmed)

```
vat            = gross_amount × 0.15        // 15% of gross, deducted first
net_after_vat  = gross_amount − vat
zid_commission = net_after_vat × 0.20       // Zid keeps 20% after VAT
developer_net  = net_after_vat × 0.80       // We receive 80% after VAT
```

Example (gross = 100): vat = 15, net = 85, zid commission = 17, our share = 68.

Payout rules (stored, displayed informationally):
- Zid invoices on the 6th of each month, pays on the 10th.
- Any single transfer under 100 SAR rolls to the next month → `is_below_minimum=true`, `status='deferred'`.

**إجمالي الإيرادات** = `SUM(developer_net_sar)` where status='paid' in range.

## Three tables

### 1. `public.zid_plan_map`
`zid_plan_code` PK, `name_en`, `name_ar`, `list_price_sar`, `billing_cycle`. ~5 seeded rows.

### 2. `public.zid_subscriptions` (one row per tenant)
`tenant_id` PK, `zid_store_id`, `zid_plan_code`, `status`, `started_at`, `current_period_end`, `cancelled_at`, `last_synced_at`.

### 3. `public.zid_charges` (append-only ledger)
`id` PK, `tenant_id`, `zid_charge_id` UNIQUE, `zid_plan_code`, `charged_at`, `status`
(paid/pending/refunded/deferred), `gross_amount_sar`, `vat_sar`, `zid_commission_sar`,
`developer_net_sar`, `payout_month`, `is_below_minimum`, `raw` jsonb.

Indexes: `(tenant_id, charged_at)`, `(status, charged_at)`, `(payout_month)`.
GRANTs to authenticated + service_role. RLS = admin-only SELECT via `admin_has_permission(auth.uid(),'admin_reports')`. Writes via service-role edge functions only.

## Sync layer

- Extend `zid-oauth-webhook` → upsert `zid_subscriptions` on install/uninstall/subscription events; insert `zid_charges` on charge events (math computed in code).
- New `zid-sync-subscriptions` (hourly pg_cron) → for each active `zid_connections` row, GET `/v1/managers/store/subscriptions` + `/v1/managers/store/charges`, upsert subscriptions, insert missing charges (idempotent on `zid_charge_id`).
- One-time backfill after deploy.

## Reports page wiring

`AdminReports.tsx` + `adminReports.ts`:
- Subscribers per plan ← `zid_subscriptions` joined to `zid_plan_map`.
- إجمالي الإيرادات ← `SUM(developer_net_sar)` paid.
- المبلغ المعلق ← `SUM(gross_amount_sar)` pending or deferred.
- Tax line ← `SUM(vat_sar)`. عمولة زد line ← `SUM(zid_commission_sar)`.
- Monthly chart ← `SUM(developer_net_sar)` by month.
- "آخر مزامنة" stamp + "تحديث الآن" button calling `zid-sync-subscriptions`.
- Excel export from the same query result.

## Mock test suite (no live Zid store needed)

### a. Seed fixture function
New `seed-zid-mock-data` edge function (admin-only) that wipes and re-inserts:
- 5 fake tenants in `zid_subscriptions` (mix of trial/active/cancelled across all 5 plans).
- ~30 deterministic rows in `zid_charges` over the last 6 months — mixed statuses, including one < 100 SAR to verify deferred flag.

### b. Webhook replay tests
`supabase/functions/zid-oauth-webhook/index_test.ts` — POST canned Zid JSON bodies (copied verbatim from docs.zid.sa) for `app.installed`, `app.store.subscription.create`, `app.store.subscription.cancel`, and charge events. Assert rows land in the right tables with correct vat/commission/developer_net values.

### c. Sync idempotency tests
`supabase/functions/zid-sync-subscriptions/index_test.ts` — stub `fetch` to return Zid-shaped JSON. Assert running the sync twice produces the same row count and `last_synced_at` advances.

### d. Revenue math test
Deno test that loads fixture data, runs the same SQL the Reports page uses, and asserts:
- 5 × 100 SAR paid charges → revenue 340, vat 75, commission 85.
- Pending + deferred sums match expected.
- Monthly bucketing equals expected per-month totals.

### e. Frontend smoke test
`AdminReports.test.tsx` — renders the page with the live RPC mocked to fixture output; asserts the KPI cards and plan table show the computed numbers.

## Files touched (build phase)

- Migration: 3 tables + GRANTs + RLS + indexes + seed `zid_plan_map`.
- `supabase/functions/zid-oauth-webhook/index.ts` — write subs + charges with formula.
- `supabase/functions/zid-sync-subscriptions/index.ts` — new, hourly via pg_cron.
- `supabase/functions/seed-zid-mock-data/index.ts` — admin-only fixture seeder.
- Test files for both edge functions + `AdminReports.test.tsx`.
- `src/app/services/adminReports.ts` — query the 3 tables.
- `src/app/components/admin/AdminReports.tsx` — Last synced, refresh button, Excel export, عمولة زد line.
