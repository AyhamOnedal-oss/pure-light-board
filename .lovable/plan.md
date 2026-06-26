
## Goal

Make the admin (Fuqah staff) experience match the merchant panel for restricted users:

1. Always show every top-level item and every sub-item in the admin sidebar — never hide them.
2. Items the staff member cannot access render dimmed, non-clickable, with the red "no-entry" circle icon and a tooltip, exactly like `Layout.tsx` does for merchant staff.
3. After login on `/admin/login`, redirect the staff member to the first page they actually have permission to see, not a hard-coded `/admin` (which fails for staff without `admin_dashboard`).

## Changes

### `src/app/components/admin/AdminLayout.tsx`
- Stop filtering `navItems`, `customersItems`, `reportsItems`, `invoicesItems` by `adminCan`. Keep the full lists; compute `allowed = adminCan(item.perm)` per item.
- For each item:
  - When `allowed`: render the existing `NavLink`.
  - When not `allowed`: render a `div` with `opacity-40 cursor-not-allowed`, a tooltip (`"You do not have access to this section" / "ليس لديك صلاحية الوصول إلى هذا القسم"`), an `onClick` that calls a `notifyLocked()` toast, and the red circle-with-slash icon (same markup used in `Layout.tsx`).
- Always render the three collapsible groups (Customer Management, Reports, Invoices). The parent button stays clickable to toggle the submenu. If **every** child in a group is restricted, render the parent itself in the disabled "no-entry" style (no toggle).
- Add a small `notifyLocked` helper inside the component using the existing `showToast` from `useApp()`.

### `src/app/components/admin/AdminLoginPage.tsx`
- Import `firstAllowedAdminPath` from `src/app/utils/adminPermissions`.
- After confirming the user has `super_admin` or `admin`, read the staff member's permissions row (super_admin → all permissions; admin → `admin_team_members.permissions` by `user_id`/email), build a `can` predicate, and `navigate(firstAllowedAdminPath(can), { replace: true })` instead of always `/admin`.

### `src/app/components/LoginPage.tsx` (only the redirect after sign-in)
- When the signed-in user has `super_admin`/`admin`, redirect through `firstAllowedAdminPath` (same helper) instead of `/dashboard` so an admin who lacks `admin_dashboard` doesn't bounce off the guard.

## Out of scope
- No DB / migration changes — `ayhamwork34@gmail.com` already has `admin_dashboard` plus the other granted keys; the routing/guards are already correct for him. The visible bug is purely the sidebar hiding items and the post-login fallback path.
- No changes to `RequireAdminPermission` or `RequireAuth` — they already handle `isAnyAdmin` and per-permission gating.
