## Team Management fixes

### 1. Remove mock data
- `src/app/services/adminTeam.ts`: delete `MOCK_TEAM` and stop returning it on error/empty. Return `[]` on any failure and surface the error via console; export a stub-free `fetchTeamMembers`.
- `src/app/components/admin/AdminTeam.tsx`: remove the `MOCK_TEAM` import and the `mockEmployees` seed. Initial state stays `[]` and only real rows from `admin_team_members` are shown.

### 2. Faster Add / Delete
Root cause: both edge functions do slow sequential auth-admin HTTP calls (`/auth/v1/admin/users`, `createUser`, `updateUserById`, `detachFromTenants`) before responding. Email send is already backgrounded; auth/role cleanup is not.

- `supabase/functions/admin-invite-employee/index.ts`
  - **Create flow**: insert the `admin_team_members` row first with `user_id: null`, respond `ok` immediately, then run auth user create + role upsert + `detachFromTenants` + email inside `EdgeRuntime.waitUntil`. Patch `user_id` onto the row when the background task finishes.
  - **Edit flow (incl. status toggle)**: perform the `update` on `admin_team_members` and respond immediately; background the role grant/revoke and `detachFromTenants` work.
  - **Resend flow**: respond immediately after loading the row; background the password reset + email + role upsert.
- `supabase/functions/admin-delete-employee/index.ts`
  - Delete the `admin_team_members` row and respond immediately. Background the auth-admin email lookup and `auth_user_roles` revoke via `EdgeRuntime.waitUntil`.
- `AdminTeam.tsx` already updates state optimistically; no UI change required beyond ensuring `busy` doesn't block the next click after the fast response.

### 3. Impersonate fails for admin employees
Root cause: `supabase/functions/admin-impersonate/index.ts` gates on `admin_has_permission(_user_id, 'customer_management')`. In our permission tree `customer_management` is a parent whose functional child is `customers` (Customers List). An admin employee granted only `customers` — which is what the "Login as customer" button lives under — is rejected.

- Update the permission check in `admin-impersonate` to allow **either** `customer_management` **or** `customers` (super-admin still bypasses via `has_role`). Log the specific denial reason so future failures surface clearly.
- No client change needed; `RequireAdminPermission` on `/admin/customers` already accepts both keys via `firstAllowedAdminPath`.

### Verification
- Load `/admin/team` on a fresh account → empty state, no mock rows.
- Add an employee → toast appears within ~200ms; row shows immediately; email arrives shortly after.
- Delete an employee → row disappears immediately; no long spinner.
- Sign in as an admin employee with only `customers` permission → "Login as customer" opens the impersonation tab successfully.
