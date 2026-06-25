# Final plan — KPI cards + server health + chart fix

Click **Implement plan** to apply.

## A. KPI cards on `/admin` wired to real data

Date filter at the top-right drives the range (all-time when none chosen). Backed by new SQL function `admin_kpis(_from, _to)` (super-admin only).

| Card | Source |
|---|---|
| Total Customers | `settings_workspace` where `platform IN ('zid','salla')`, by `created_at` |
| Inactive Customers | mock (deferred) |
| Total Uninstalls | `zid_connections + salla_connections` where `is_active=false`, by `updated_at` |
| Active Customers | `Total − Inactive` |
| Total Bubble Clicks | `sum(dashboard_usage_daily.clicks)` |
| Avg Response Time | `avg(first_response_at − created_at)` on `conversations_main` |

% chip compares to the previous window of equal length; hidden in all-time.

## B. حالة الخوادم — real uptime tracking

- New table `admin_health_checks` (provider, status `up`/`degraded`/`down`, latency_ms, http_code, error, checked_at).
- New edge function `health-check`, scheduled every 5 min via `pg_cron`, that probes:
  - **Supabase** → `/auth/v1/health` (HTTP 200 = up, else down)
  - **OpenAI** → `status.openai.com/api/v2/status.json`
  - **Resend** → `resend-status.com/api/v2/status.json`
  - **Hostinger** → HTTP GET on the configured domain

Statuspage indicator mapping (no AI; deterministic):

| `status.indicator` | UI |
|---|---|
| `none` | 🟢 up |
| `minor` / `maintenance` | 🟡 degraded |
| `major` / `critical` | 🔴 down |

Server cards read the latest row per provider. Three-state pill:

| State | EN | AR |
|---|---|---|
| up | Connected | متصل |
| degraded | Partially Operational | تقريباً متصل |
| down | Disconnected | غير متصل |

Tooltip shows `status.description` (e.g. "Partial System Degradation") plus `last checked Xm ago`. When a provider flips to `down`, insert one `app_notifications` row (`kind='server_down'`).

## C. Chart fix — New Subscribers Over Time

`YAxis width 30 → 42`, add `tickMargin={6}` and `margin={{ top: 10, right: 12, bottom: 0, left: 8 }}` on the `<LineChart>` so axis labels stop overlapping the line.

## Files
- Migration (already approved & run): `admin_kpis` function + `admin_health_checks` table.
- New edge function `supabase/functions/health-check/index.ts` (verify_jwt=false; cron-driven).
- `cron.schedule('health-check-5min', '*/5 * * * *', …)` inserted via the data tool (uses project URL + anon key).
- `src/app/services/adminDashboard.ts`: add `fetchAdminKpis(from, to)` + `fetchServerHealth()`.
- `src/app/components/admin/AdminDashboard.tsx`: KPI cards bound to live data; server-status grid uses 3-state pill + tooltip; YAxis width bumped.
