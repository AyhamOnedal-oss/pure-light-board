## Goals

1. Customers table only shows tenants that have at least one real auth user.
2. Fix "Login as Customer" (admin impersonation) so it actually opens the merchant's dashboard.
3. Reports for Zid and Salla show real data (no mock fallback).

## 1. Filter customers to those with auth

`src/app/services/adminCustomers.ts` currently returns every row in `settings_workspace`, even tenants with no linked auth user (e.g. seeded Zid stores). These have no owner email, no real session, and impersonation cannot work for them.

Change `fetchAdminCustomers()`:
- Also fetch `auth_tenant_members` (tenant_id, user_id).
- Build a `Set<tenantId>` of tenants that have at least one member.
- Only include tenants in that set in the result.
- If after filtering the list is empty, return `[]` (do **not** fall back to `MOCK_CUSTOMERS` or `admin_customers_seed`).

`AdminCustomers.tsx` already merges pipeline rows on top, so cancelled/expired pipeline entries still show — only the DB-tenant section is filtered.

## 2. Fix admin impersonation

Two real problems in `supabase/functions/admin-impersonate/index.ts` + `AdminCustomers.tsx`:

a. Many tenants have no `auth_tenant_members` row, so the function returns 404. Filtering in step 1 eliminates these from the UI, so the button is only offered for tenants that actually have an owner.

b. The current flow uses Supabase `generateLink({ type: 'magiclink' })` and opens the link in a new tab. Two issues:
   - The merchant app and admin app share `localStorage`, so consuming the magic link overwrites the admin's own session in the same browser.
   - The redirect URL is built from `origin/dashboard`, but Supabase requires it to be on the configured Site URL / Redirect URLs list, otherwise it bounces back to the project default.

Plan:
- Switch the edge function to `generateLink({ type: 'magiclink' })` but return only the raw `action_link` (already done) and **also** include `email` and `hashed_token` / `token_hash` from `linkData.properties` so the client can build a clean verify URL.
- On the client, open the impersonation in a new tab pointed at a new route `/admin/impersonate?token=...&email=...&tenant=...`.
- That route mounts an isolated Supabase client (separate `storageKey: 'sb-impersonate-<tenantId>'`, `storage: sessionStorage`) that does **not** clobber the admin session. It calls `supabase.auth.verifyOtp({ type: 'magiclink', token_hash, email })`, then navigates the same tab to `/dashboard`.
- The main app's default client still uses the default storage key, so the admin remains signed in on the original tab.
- If creating a fully isolated session proves too invasive, the fallback (and simpler short-term fix) is to detect impersonation in `client.ts` via a URL flag and switch the storage key for the whole tab so the admin tab is untouched. We'll go with the isolated-client approach first; fallback only if needed.

Also:
- Update `redirectTo` to use `https://app.fuqah.ai/dashboard` plus the current origin as a fallback, and document that the origin must be in Supabase Auth → URL Configuration → Redirect URLs.
- Return clearer errors (e.g. distinguish "no owner" from "supabase rejected redirect").

## 3. Reports: real data for Zid and Salla

`fetchAdminReports()` falls back to `MOCK_REPORTS` whenever `admin_reports_plans` / `admin_reports_revenue_monthly` are empty. Replace the fallback with a live computation from real tables.

New behavior:
- Query in parallel:
  - `settings_workspace(id, platform, plan, status, created_at)`
  - `settings_plans(tenant_id, monthly_word_quota, ...)` — only needed if we map plan from there; otherwise rely on `settings_workspace.plan`.
  - `zid_connections(tenant_id, is_active, created_at)`
  - `salla_connections(tenant_id, is_active, created_at)`
- Resolve each tenant's platform: prefer `salla_connections` → `Salla`, else `zid_connections` → `Zid`, else `settings_workspace.platform`.
- Bucket by plan name into the existing 5 rows (Trial / Economy / Basic / Professional / Business) with fixed prices `{0, 99, 199, 399, 799}`. Compute `subscribers = count` and `total = subscribers * price` per platform.
- For `revenueByMonth`, group tenants by `created_at` month within the current year and sum `price` per platform.
- Return real data even when arrays are empty (zeros), so we never silently show mock.
- Remove all references to `MOCK_REPORTS` from `AdminReports.tsx` initial state — default to an empty `{ zidPlans: [], sallaPlans: [], revenueByMonth: [] }` and a loading state.

Keep the existing `admin_reports_plans` / `admin_reports_revenue_monthly` tables as an optional override: if they have rows, use them; otherwise compute live from real tenants. Never fall back to mock.

## Files touched

- `src/app/services/adminCustomers.ts` — filter by `auth_tenant_members`, drop mock fallback.
- `src/app/services/adminReports.ts` — compute live from `settings_workspace` + connections; remove mock fallback.
- `src/app/components/admin/AdminReports.tsx` — start with empty data, not `MOCK_REPORTS`.
- `supabase/functions/admin-impersonate/index.ts` — return `token_hash`/`email`, refine errors.
- `src/app/components/admin/AdminCustomers.tsx` — open new `/admin/impersonate` route in new tab.
- New `src/app/components/admin/AdminImpersonateRedirect.tsx` + route entry in `src/app/routes.tsx` — isolated Supabase client that verifies the OTP into its own storage key and redirects to `/dashboard`.

No database migrations required.