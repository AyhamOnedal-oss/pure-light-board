## Goal
On `/admin/customers`, show real tenant data (plan, usage, words, status) and make the "Login as customer" button actually open that tenant's dashboard.

## 1. Real customer data — `src/app/services/adminCustomers.ts`

Replace the current single `settings_workspace` query with an enriched fetch:

- `settings_workspace` → base row (id, name, platform, plan, status, domain).
- `settings_plans` (by tenant_id) → `monthly_word_quota`, `monthly_words_used` → `totalWords`, `words`, `usagePercent`.
- `zid_connections` / `salla_connections` (by tenant_id, `is_active=true`) → fallback platform + `store_email` for the email column + override status to `active` when a live connection exists.
- Status: `cancelled` if `settings_workspace.status='cancelled'`; otherwise `active` if any active connection or non-zero usage in the last 30 days (via `dashboard_usage_daily`), else `inactive`.
- Email priority: connection.store_email → workspace.domain → '—'.
- Keep the same `AdminCustomerRow` shape so the table renders unchanged.
- Keep the seed/mock fallback only when zero tenants exist.

## 2. "Login as customer" — admin impersonation

New edge function `supabase/functions/admin-impersonate/index.ts`:
- Auth: requires caller JWT; verify caller has `super_admin` role OR `admin_has_permission(caller, 'customer_management')` via service-role client. Reject otherwise.
- Input: `{ tenantId }`.
- Resolve target user: pick the `auth_tenant_members` row for that tenant with `role='owner'` (fall back to oldest member). Get their email via `supabase.auth.admin.getUserById`.
- Generate a magic link: `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: <SITE_URL>/dashboard } })`.
- Return `{ url, email, tenantId }`.
- Log a row into a new lightweight `admin_impersonation_log` (tenant_id, admin_user_id, target_user_id, created_at) for auditing.

Migration: create `public.admin_impersonation_log` with GRANTs + RLS (only super_admin can read; insert via service role only).

## 3. Wire the button — `src/app/components/admin/AdminCustomers.tsx`
- Replace the empty `<button>` for `LogIn` with an `onClick` that calls the edge function via `supabase.functions.invoke('admin-impersonate', { body: { tenantId: c.id } })`.
- On success, `window.open(url, '_blank')`; on error show a toast.
- Disable the button for pipeline-derived rows (`id` starts with `pipe_`) since those have no auth user.
- Add a small loading spinner state per row while the request is in flight.

## Notes for the user
- Impersonation works only for tenants whose owner has a real Supabase auth user (all Zid/Salla OAuth installs do).
- The opened tab is a real magic-link session for that user — closing it doesn't affect your admin session.

## Out of scope
- No changes to the customer details page, sidebar, or pipeline view.
- No changes to the existing landing-page lead flow.
