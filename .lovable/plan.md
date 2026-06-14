## Issues found

### 1. Re-inviting a previously-deleted user fails ("فشل إضافة العضو") — root cause of the screenshot

`supabase/functions/invite-employee/index.ts` runs two duplicate checks against `team_members` **without filtering out soft-deleted rows**:

- Lines 165–173: `select id from team_members where tenant_id=? and email=?` → returns the old soft-deleted row → returns `409 email_exists` → UI toasts "فشل إضافة العضو".
- Lines 176–186: same problem for `phone`.

Because `delete-employee` soft-deletes (`deleted_at=now()`) instead of hard-deleting, that old row blocks every re-invite of the same email/phone in the same tenant.

A secondary bug in the same function: the upsert branch at lines 230–251 finds the soft-deleted row and updates it but **doesn't clear `deleted_at` / `auth_revoked_at`**, so even if the duplicate check were bypassed, the row stays hidden in the UI (which filters `deleted_at IS NULL`).

### 2. "Deactivate" doesn't actually freeze the user

The DB has `disabled_at`, `dashboard_snapshot`, `status='inactive'`, and an `AccountDisabledScreen` component exists — but nothing in `AppContext` / `RequireAuth` / `LoginPage` ever checks them. A disabled employee can still log in and use every page normally. The captured `dashboard_snapshot` is also never read.

### 3. "Delete" already revokes login correctly

`delete-employee` soft-deletes the row, removes `auth_tenant_members`, and calls `auth.admin.deleteUser` when the user has no other memberships. That part is fine — it just needs the re-invite path (issue 1) to actually work afterwards.

---

## Plan

### A. Fix re-invite of deleted users (`invite-employee` edge function)

1. In both duplicate-check queries, add `.is('deleted_at', null)` so soft-deleted rows are ignored. A deleted member's email/phone is treated as free.
2. In the "find existing row to update" lookup (line 230), keep matching any row (deleted or not), but on update **always set `deleted_at: null`, `auth_revoked_at: null`, `disabled_at: null`, `dashboard_snapshot: null`, `status: 'active'`** alongside the new name/phone/permissions. This revives a previously-deleted member instead of inserting a duplicate (avoids violating any unique key on `tenant_id,email`).
3. If the previous auth user was hard-deleted by `delete-employee`, the existing "find or create auth user" block already handles that — it falls through to `createUser` and links the new `user_id`. No extra change needed.

### B. Enforce "Deactivated user is frozen at last dashboard" (no other access)

1. Extend `AppContext` to load the current user's `team_members` row for the active tenant (`status`, `disabled_at`, `dashboard_snapshot`, `deleted_at`) and expose `memberStatus`, `isDisabled`, `isDeleted`, `frozenSnapshot`.
2. `LoginPage`: after successful login, if the matching `team_members` row has `deleted_at IS NOT NULL`, sign the user out immediately and show "تم حذف حسابك من هذا المتجر".
3. `RequireAuth`: if `isDisabled`, redirect every route except `/dashboard` to `/dashboard`. The dashboard becomes the only reachable page.
4. `DashboardPage`: when `isDisabled && frozenSnapshot` exists, render the snapshot in read-only mode (no date-range picker, no refresh, no live queries) with an Arabic banner: "تم تعطيل حسابك — هذه آخر لقطة من لوحة التحكم". Owners/admins are unaffected (they have no `team_members` row tied to themselves, or their row isn't disabled).
5. Tenant-owner / super-admin paths skip the check entirely.

### C. Cleanup / safety

- Add a small DB index `team_members(tenant_id, email) where deleted_at is null` for the new duplicate lookup (optional, only if migration is desired).
- No schema changes are strictly required; all needed columns already exist.

---

## Technical details

**Files to change**
- `supabase/functions/invite-employee/index.ts` — duplicate-check filters + revive logic on update.
- `src/app/context/AppContext.tsx` — load `team_members` self-row, expose `isDisabled` / `isDeleted` / `frozenSnapshot`.
- `src/app/components/RequireAuth.tsx` — redirect disabled users to `/dashboard` only; sign out deleted users.
- `src/app/components/LoginPage.tsx` — block sign-in for `deleted_at IS NOT NULL` rows.
- `src/app/components/DashboardPage.tsx` — render frozen snapshot when disabled.
- (Optional) one migration adding the partial unique index above.

**Out of scope**
No changes to `delete-employee` (already correct). No changes to permissions model. No changes to widget files.

## What this delivers

- Admin can re-invite a previously deleted user with the same email/phone — invitation email goes out and the row reappears as active.
- "Deactivate" really freezes the user: they can log in, but every page is locked except a read-only dashboard frozen at the moment of deactivation.
- "Delete" already kicks them out immediately and removes login privileges while keeping the historical row in the DB for archiving.
