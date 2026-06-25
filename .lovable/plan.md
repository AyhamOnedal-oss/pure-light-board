Root cause to fix:
- Internal Fuqah staff are currently identified with a broad `admin` role, but their saved `admin_team_members.permissions` are not used by the admin routes/sidebar/actions.
- Most `admin_*` database policies and `admin_kpis()` still allow only `super_admin`, so admin employees can enter `/admin` but cannot read real stats/data, which causes empty/zero states.
- Invite/edit/delete does repeated auth lookups by email and blocks on email sending, so staff actions feel slow.

Plan:
1. Add a real internal-staff identity link
   - Add `user_id` to `admin_team_members` with indexes for `user_id`, `email`, and `status`.
   - Keep roles separate: `super_admin` = owner (`admin@fuqah.ai`), `admin` = Fuqah internal employee, tenant employees remain only in tenant/team tables.
   - Backfill/maintain `user_id` through the admin invite function whenever creating, editing, resending, or activating staff.

2. Create admin-staff permission enforcement
   - Add a database helper like `admin_has_permission(user_id, permission_key)`.
   - It returns full access for `super_admin`, and checks active `admin_team_members.permissions` for internal `admin` employees.
   - Update admin dashboard/stat policies and RPCs so staff with the right permission can read real data instead of zeros.

3. Wire admin permissions into the frontend
   - Extend `AppContext` with `adminPermissions`, `adminPermissionsLoading`, and `adminCan(key)`.
   - Super admin gets all permissions.
   - Admin employees get only their saved `admin_team_members.permissions`.
   - If an employee has no permission for `/admin`, route them to their first allowed admin page, not `/dashboard`.

4. Gate the admin UI by permission
   - Filter Admin sidebar items by permission:
     - Dashboard → `admin_dashboard`
     - Team Management → `team_management`
     - Customer Pipeline/List → `pipeline`, `customers`
     - Reports → `reports_*`
     - Billing → `billing_*`
     - Ad Automation → `ad_automation`
   - Add action-level permissions for automation, e.g. `ad_automation_add`, `ad_automation_delete`, `ad_automation_sync`, so “Add Automation” is clickable only when granted.
   - Hide/disable restricted buttons and protect direct URL access with an admin route guard.

5. Fix zero stats for admin employees
   - Allow real reads for dashboard/admin data only when the employee has the corresponding permission.
   - Update `admin_kpis()` and `admin_db_usage()` to allow `super_admin` or staff with `admin_dashboard`.
   - Remove misleading mock/zero fallback where it hides permission failures; show a proper restricted/no-access state instead.

6. Speed up invite/edit/delete/render
   - Stop repeated auth-user lookup by email where `user_id` is already known.
   - Make delete/status/edit use `user_id` directly for role revoke/grant.
   - Do optimistic UI updates in `AdminTeam` and reload quietly afterward.
   - Make email sending non-blocking after the account/role/team row succeeds, so the UI does not wait on Resend latency.
   - Add proper loading states instead of mock fallbacks while the team list loads.

7. Verify
   - Test as super admin: full stats, full sidebar, full team actions.
   - Test as restricted admin employee: `/admin` opens, real allowed stats/data show, restricted menu/actions are hidden/blocked, no `/dashboard` redirect.
   - Test invite/add/delete performance and confirm the email link points to `fuqah.ai/admin/login`.