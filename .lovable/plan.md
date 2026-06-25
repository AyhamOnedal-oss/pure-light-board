## What "% usage" means here

Per Supabase Pro pricing, each project ships with **8 GB of provisioned disk included** ($0.125/GB beyond). The actionable headline is therefore:

```
percent = pg_database_size(current_database()) / (8 * 1024^3) * 100
```

`pg_database_size` is the real data size reported by Postgres (same number shown on the Supabase Database Reports page). Disk size (which includes WAL + bloat) isn't queryable from SQL — only Supabase's Management API exposes it — so we use database size as the proxy, capped at 100%.

Hostinger / Resend / OpenAI stay as their current seeded `usage_percent` values until you decide on a metric for each.

## Changes

### 1. Migration — new SECURITY DEFINER RPC

`public.admin_db_usage()` returns:
```json
{ "bytes": 12345678, "included_bytes": 8589934592, "percent": 0.14 }
```
- Guards with `public.has_role(auth.uid(), 'super_admin')` (same pattern as `admin_kpis`).
- `included_bytes` hard-coded to `8 * 1024^3` (Pro plan included disk).
- `percent` rounded to 2 decimals, capped at 100.
- `GRANT EXECUTE … TO authenticated` (the role check inside enforces super-admin only).

### 2. `src/app/services/adminDashboard.ts`

Add `fetchSupabaseUsage()` that calls `supabase.rpc('admin_db_usage')` and returns `{ bytes, percent } | null` (null on error so the UI falls back to the seeded value).

### 3. `src/app/components/admin/AdminDashboard.tsx`

- Add `useState<{ bytes:number; percent:number } | null>` for live Supabase usage; fetch in the existing dashboard `useEffect`.
- In the `serverUsage` memo, when `s.name === 'Supabase'` and live value exists, override `usage` with the live percent and append a tooltip like `"1.2 GB / 8 GB"` (shown via a `title` attr on the bar row).
- All other rows unchanged.

## Out of scope (call out)

- Hostinger live metric — needs a VPS agent or Hostinger API token; not part of this change.
- Resend live metric — needs Resend API + monthly cap config.
- OpenAI live metric — needs OpenAI usage API + monthly budget config.

Pick any of these later and I'll wire them the same way.
