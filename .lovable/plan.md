## Two bugs to fix

### 1. Logging out from admin shows "تم حذف حسابك من قبل المسؤول"

**Cause** — `src/app/context/AppContext.tsx` lines 134–145: the `onAuthStateChange` listener redirects to `/login?reason=deleted` whenever it sees `SIGNED_OUT`, `TOKEN_REFRESHED`, or `USER_DELETED` with no session. `SIGNED_OUT` also fires on an explicit user‑initiated logout, so every super‑admin / user logout now lands on the login page with the "account deleted" banner.

**Fix** — Track explicit sign‑outs and never show the deleted reason for them.
- Add a `explicitSignOutRef = useRef(false)` in `AppProvider`.
- In `signOut()`, set `explicitSignOutRef.current = true` before calling `supabase.auth.signOut()`.
- In the auth listener, only redirect to `/login?reason=deleted` when (a) `explicitSignOutRef.current === false` AND (b) the event is `USER_DELETED`, OR `TOKEN_REFRESHED` with a null session (token refresh failure ⇒ server‑side revocation). Treat plain `SIGNED_OUT` as a normal logout — just navigate to `/login` without the `reason` param.
- Reset the ref to `false` after handling.

Also: in the tenant‑resolution effect (lines 184–203) the same `reason=deleted` redirect fires when a user genuinely has zero memberships. Keep that path intact — it is correct for actually deleted accounts.

### 2. Deleting a team member shows "فشل الحذف"

**Cause to confirm in build mode** — `supabase/functions/delete-employee/index.ts` returns `{ error: 'forbidden' | 'not_found' | 'invalid_auth' | ... }` and the client (`TeamPage.confirmDelete`) collapses every non‑ok response to the same generic toast, so we can't see why. Likely culprits, in order:
1. The caller is a super‑admin who has no `auth_tenant_members` row in the target tenant → `caller` is null → `403 forbidden`.
2. The caller is a tenant member with role `viewer`/`member` (not `owner`/`admin`) → `403 forbidden`.
3. A schema/permission slip we'll surface via logging.

**Fix**
- In `delete-employee/index.ts`, when the caller is **not** a tenant member of `tenant_id`, additionally check `auth_user_roles` for `super_admin` and allow the deletion in that case (super admins manage every tenant from `/admin`).
- Return a descriptive `error` string for every failure branch and `console.error` it so the next attempt shows up in edge‑function logs.
- In `src/app/components/TeamPage.tsx` `confirmDelete`, surface the function's `error` message in the toast (fallback to the current generic Arabic text) so future failures are debuggable from the UI: `showToast(t(\`Failed to delete: ${msg}\`, \`فشل الحذف: ${msgAr}\`))`.

### Out of scope
- No DB migration, no RLS changes, no UI redesign.
- The dashboard team page (`/dashboard/team`) and admin team page (`/admin/team`) keep their existing layouts.

### Verification
1. Sign in as super admin → click Logout from `/admin`. Expect: lands on `/login` with **no** "account deleted" message.
2. Sign in as tenant owner → delete a team member from `/dashboard/team`. Expect: row disappears, toast "تم حذف العضو". If it still fails, the toast now shows the real reason and the edge function logs the cause for a follow‑up fix.
3. Sign in as super admin → delete a team member from any tenant via `/admin/team` (already uses a different code path, sanity check).
