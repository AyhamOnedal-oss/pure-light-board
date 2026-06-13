# Delete member = revoke login, keep data

Today the "Delete" action wipes the `team_members` row, the tenant membership, and the auth user — so the archive (conversations, activity, etc.) loses its owner reference. Goal: keep all historical data intact, but make sure the deleted person can never sign in again, is kicked out of any active session, and sees a clear Arabic message if they try to sign in.

## 1. Database — mark members as deleted instead of removing them

New migration on `public.team_members`:
- Add `deleted_at timestamptz` (nullable).
- Add `auth_revoked_at timestamptz` (nullable) — stamped when the auth account is destroyed; used by the client to force-logout and to detect deleted users at the login screen.
- Index on `(tenant_id, deleted_at)` for the list query.
- Add a public, security-definer RPC `public.is_email_deleted(_email text) returns boolean` that returns `true` when any `team_members` row with that email has `deleted_at is not null`. Granted to `anon` so the login page can check before/after a failed sign-in without exposing the table.

No data is removed. Conversations, tickets, notes, snapshots, everything stays.

## 2. Edge function — `delete-employee` rewrite

Change behavior to soft delete + auth purge:

1. Authorize caller (owner/admin) — unchanged.
2. Load the `team_members` row to get `user_id` + email.
3. `UPDATE team_members SET deleted_at = now(), auth_revoked_at = now(), status = 'inactive' WHERE id = :member_id` (keep the row + all FKs intact).
4. `DELETE FROM auth_tenant_members WHERE tenant_id = :tenant AND user_id = :user` so they lose workspace access immediately.
5. `auth.admin.deleteUser(user_id)` — only when the user has no other `auth_tenant_members` rows and no other non-deleted `team_members` rows. This invalidates their refresh token so they can't get a new session.
6. If they belong to another workspace, skip step 5 (don't nuke unrelated tenants) and rely on step 4 to lock them out of this one.

Return `{ ok: true, auth_deleted: boolean }`.

## 3. Frontend — TeamPage

- `fetchMembers` query filters `deleted_at is null` so deleted members disappear from the roster (data still in DB for archival).
- `confirmDelete` keeps invoking `delete-employee`; toast copy stays the same.

## 4. Force-logout of an active session

A deleted user keeps a valid JWT until expiry (~1h). Two safeguards in `AppContext`:

- **Token refresh failure**: in `onAuthStateChange`, when the event is `TOKEN_REFRESHED`/`SIGNED_OUT` with no session while we held one, call `signOut()` and route to `/login?reason=deleted`.
- **Server-side check on tenant resolve**: when `session` exists but the user has zero `auth_tenant_members` AND is not super admin, call `signOut()` and route to `/login?reason=deleted`. Catches users deleted mid-session the next time the effect runs.

## 5. Login page — Arabic "account deleted" message

`LoginPage` changes:

- If the URL has `?reason=deleted`, render the banner immediately:
  > **عذراً، تم حذف حسابك من قبل المسؤول.**
  > (EN fallback when language is English: "Sorry, your account has been deleted by the admin.")
- On a failed `signIn` attempt where Supabase returns `Invalid login credentials` or `Email not confirmed`, call the new `is_email_deleted` RPC with the typed email. If it returns `true`, replace the generic error with the same Arabic message above instead of the default "wrong password" text.
- The banner uses the existing toast/error styling already in `LoginPage` — no new components.

## Technical notes

- Migration only adds columns + index + one RPC; no RLS change to existing tables.
- `is_email_deleted` is `security definer`, `stable`, scoped to `team_members.email`, returns boolean only — safe to expose to `anon`.
- Edge function still uses the service-role client for `auth.admin.deleteUser`; caller auth validated first.
- `src/integrations/supabase/types.ts` regenerates after the migration so new columns + RPC are typed.

## Files touched

- `supabase/migrations/<new>.sql` — columns, index, `is_email_deleted` RPC + grant.
- `supabase/functions/delete-employee/index.ts` — soft-delete + conditional auth purge.
- `src/app/components/TeamPage.tsx` — filter `deleted_at is null` in the members fetch.
- `src/app/context/AppContext.tsx` — two force-logout safeguards, redirect to `/login?reason=deleted`.
- `src/app/components/LoginPage.tsx` — banner on `?reason=deleted` + post-failure RPC check showing the Arabic message.
