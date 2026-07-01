## What I found

1. **Slowness on invite/delete**: the edge functions already background the auth work, but the UI still `await`s the invoke round-trip (~500–800 ms) before showing the row. Delete is optimistic; invite is not.
2. **"العملاء" section missing in the permission tree**: the tree already has `pipeline` + `customers`, but there is no explicit **"صفحة الهبوط"** node — landing page currently piggy-backs on `pipeline`. So an admin employee can never be given landing-only access, and the label the user expects (a dedicated node) isn't there.
3. **صفحة الهبوط empty for admin employees**: the RLS policies on `admin_landing_leads` check `admin_has_permission(uid, 'admin_pipeline')`, but the real key in the app is `pipeline` (and, after this change, `landing`). Non-super admins are silently denied.
4. **سير العملاء empty for admin employees**: the whole pipeline board is stored in `localStorage` (`pipelineData.ts`). Super-admin's browser has data; every other admin sees an empty board. This is why the data doesn't match. It has to move to Supabase to be shared.

## Plan

### A. Instant invite (fix perceived slowness)
- In `AdminTeam.tsx`, insert the new employee optimistically into the list the moment "Add" is clicked, close the modal immediately, then reconcile with the server response in the background. Same optimistic pattern for edit and toggle (delete is already optimistic).
- Show a subtle spinner on the affected row while the background invoke resolves; roll back on error with a toast.

### B. Add "Landing Page" and clean "Customers" nodes in the permission tree
- Extend `ADMIN_PERMISSION_TREE` in `src/app/utils/adminPermissions.ts`:
  - Under `customer_management`, add a third child `landing` → "صفحة الهبوط / Landing Page".
- Update `AdminLayout.tsx` sidebar so the Landing Page item uses `perm: 'landing'` instead of `pipeline`.
- Update `RequireAdminPermission` guard for `/admin/pipeline/landing` to require `landing`.

### C. Fix landing-leads RLS
- New migration to drop the three `admin_landing_leads_*` policies and recreate them using the correct keys:
  - `has_role(auth.uid(),'super_admin') OR admin_has_permission(auth.uid(),'landing') OR admin_has_permission(auth.uid(),'pipeline')`
  - (Keeping `pipeline` in the OR preserves access for existing admins who already have the pipeline permission, so nothing breaks after the rename.)

### D. Move Pipeline (سير العملاء) to Supabase so all admins share it
- New table `admin_pipeline_customers` mirroring the `PipelineCustomer` shape (id, name, email, phone, source, subscribed_via, status, subscription_price, subscription_plan, start_date, end_date, notes jsonb, journey jsonb, custom_columns jsonb, custom_data jsonb, viewed_by jsonb, notes_seen_by jsonb, created_at, updated_at, created_by).
- Grants: `authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` ALL. No `anon`.
- RLS: `has_role(super_admin) OR admin_has_permission(uid,'pipeline')` for SELECT/INSERT/UPDATE/DELETE.
- Realtime: add table to `supabase_realtime` publication.
- Refactor `pipelineData.ts`:
  - Keep the exported types unchanged.
  - Replace `loadCustomers/saveCustomers` with async `fetchCustomers/upsertCustomer/deleteCustomer` calls against Supabase.
  - Provide a thin in-memory cache + subscribe helper so the sidebar badge and `AdminPipelinePage` don't spam the DB.
  - One-time migration on first load: if `localStorage.admin_pipeline_customers_v2` exists AND the server table is empty for this admin org, upload it, then clear the key.
- Update all four consumers (`AdminPipelinePage`, `AdminPipelineDetailPage`, `AdminLandingLeadDetailPage`, `LandingLeadsTable`, `AdminLayout` badge) to the async API. Add loading spinners so no default/empty flash.

### E. Verify
- Sign in as super_admin → data still shows.
- Sign in as an admin employee with `pipeline` + `landing` → same rows appear.
- Invite a new employee → row appears instantly; edit/toggle instant; email still sent in background.

## Technical notes

- The RLS rename in step C is backwards-compatible (OR-ed).
- The pipeline table is org-wide (there's only one admin tenant), so no `tenant_id` scoping is needed — just role/perm checks.
- Realtime subscription in `AdminPipelinePage` will replace the current `window` storage-event listener.
- No changes to super_admin behavior; only widens read/write to permitted admin staff.
