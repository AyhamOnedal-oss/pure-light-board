# Separate Admin Employees from Tenant Employees

## Problem

Employees invited from **Admin Panel → Team Management** are meant to be Fuqah's internal staff (admin panel users). Currently the `admin-invite-employee` edge function:

- Creates an `auth.users` record
- Inserts a row in `admin_team_members`
- Sends a welcome email pointing to `/login`

But it never assigns any role in `auth_user_roles`. So when the invited employee signs in:

- `isSuperAdmin` is `false`
- They have no tenant membership → `AppContext` either marks the account as "deleted" or drops them on `/dashboard` (the user/tenant panel)
- They appear mixed in with merchant employees, never reach `/admin/*`

Tenant-side `team_members` (clients' employees) must stay completely independent of `admin_team_members` (Fuqah's employees).

## Fix

### 1. Database — add an `admin` role tier

Migration:
- Add a new value `'admin'` to whatever enum / check constraint backs `auth_user_roles.role` (alongside the existing `super_admin`). If the column is free-text, no enum change is needed.
- No table changes for `admin_team_members`; we'll just GRANT/REVOKE roles based on its rows.

### 2. Edge function `admin-invite-employee`

After creating/finding the auth user (both Create and Resend flows):
- `upsert` into `auth_user_roles` with `{ user_id, role: 'admin' }` (unique on user_id+role).
- On status change to `inactive` (handled in the edit flow): `delete` that role row so the employee can no longer enter `/admin`.
- Change the email `loginUrl` from `/login?...` to `/admin/login?email=...&invite=1`.
- Email copy stays the same Arabic welcome template.

### 3. Edge function `admin-delete-employee`

- Also delete the matching `auth_user_roles` row for that user (role = 'admin'). Optionally delete the auth user too (safer: just revoke the role and let the auth account sit dormant — confirm in implementation).

### 4. `AppContext.tsx`

- Expand the role-loading effect to fetch both `super_admin` and `admin` roles in one query and expose `isAdminEmployee` plus the existing `isSuperAdmin`. Add `isAnyAdmin = isSuperAdmin || isAdminEmployee`.
- In the "no memberships" deletion guard, treat `isAnyAdmin` the same as super_admin (don't force sign-out — admin employees legitimately have no tenant).

### 5. Routing — `RequireAuth.tsx` and `LoginPage.tsx`

- `RequireAuth`: when `requireSuperAdmin` is on, accept either `super_admin` or `admin`. When a user with the `admin` role lands on `/dashboard*`, redirect to `/admin` (same behavior as super_admin today).
- `LoginPage` post-auth redirect: if `isAnyAdmin`, navigate to `/admin`; otherwise `/dashboard` as today.
- `AdminLoginPage` post-auth check: after `signIn`, verify the user has `super_admin` OR `admin` role; if not, `signOut` and show "Not an admin account" error (prevents tenant employees from using the admin login page).

### 6. Admin panel permission gating (light touch)

- `AdminLayout` / admin route guards already exist for super_admin via `requireSuperAdmin`. Switch them to "requireAdminAccess" (super_admin OR admin).
- Within the admin panel, fine-grained access for `admin` role is governed by `admin_team_members.permissions` — that gating already exists in the UI (via `RequirePermission` etc.) and is out of scope for this change.

### 7. AdminTeam.tsx (UI)

- `toggleStatus` already updates `admin_team_members.status`. Also call the edge function (or a new small one) so that flipping to `inactive` revokes the `auth_user_roles` admin row, and flipping back to `active` re-grants it. Keep the UX unchanged.

## Technical notes

- `auth_user_roles` schema: confirm whether `role` is a Postgres enum (`app_role`) or text. If enum, `ALTER TYPE app_role ADD VALUE 'admin'` in its own migration (cannot run inside a transaction with other DDL, so submit as a single statement migration first, then a second migration for grants/policies if needed).
- Keep `super_admin` reserved for Fuqah founders; `admin` is for staff invited from the Admin Team panel. Both unlock `/admin/*`.
- Tenant-side flows (`team_members`, `invite-employee`) are untouched — clients' employees continue to be tenant-scoped and never get an `auth_user_roles` row.
- Existing admin employees already created before this fix will need a one-off backfill: `INSERT INTO auth_user_roles(user_id, role) SELECT u.id, 'admin' FROM auth.users u JOIN admin_team_members m ON lower(u.email)=lower(m.email) WHERE m.status='active' ON CONFLICT DO NOTHING;` — included in the migration.

## Out of scope

- Per-permission enforcement inside the admin panel (already handled by existing `RequirePermission` / permission tree).
- Changes to the tenant invite flow (`invite-employee`, `team_members`).
