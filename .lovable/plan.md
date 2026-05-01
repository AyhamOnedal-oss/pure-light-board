I understand now: the admin panel already exists, but the current login/redirect flow still treats the admin account like a tenant/user account in some cases, so you end up on `/dashboard` instead of the admin area.

Plan:

1. Fix login redirect precedence
   - Update the shared login page so when `admin@fuqah.ai` signs in and the `super_admin` role is resolved, it always sends them to `/admin`.
   - Avoid letting an old `location.state.from` value like `/dashboard` override the admin destination.
   - Keep regular users going to `/dashboard`.

2. Restore the admin login route behavior
   - Stop redirecting `/admin/login` to the normal user login in a way that causes confusion.
   - Either wire `/admin/login` to the admin login screen, or make it a clear alias that signs in via Supabase and lands on `/admin`.
   - Remove the stale hardcoded admin credentials currently in `AdminLoginPage` (`support@samksa.ai` / `123456Aa`) so the app uses the real role-based admin account: `admin@fuqah.ai` / `123456`.

3. Make `/admin` access reliable
   - Keep `/admin` protected by the `super_admin` role.
   - Ensure the guard waits for both auth and role loading before redirecting.
   - If a signed-in super admin manually visits `/admin`, they should stay there.
   - If a non-admin visits `/admin`, they should be redirected to `/dashboard`.

4. Polish admin/user identity labels
   - Update the admin sidebar footer from the old hardcoded email `support@samksa.ai` to the actual signed-in admin email.
   - Optionally update the user dashboard footer to show the current user email instead of demo text, so the account context is clear.

Technical details:

- Files to update:
  - `src/app/components/LoginPage.tsx`
  - `src/app/components/admin/AdminLoginPage.tsx`
  - `src/app/routes.tsx`
  - `src/app/components/admin/AdminLayout.tsx`
  - optionally `src/app/components/Layout.tsx`

- No database migration should be needed because the network logs confirm:
  - `admin@fuqah.ai` signs in successfully.
  - `auth_user_roles` returns `[{ role: "super_admin" }]` for that admin user.

Expected result after the fix:

- Go to `/admin/login` or `/login`.
- Sign in with `admin@fuqah.ai` / `123456`.
- You land on `/admin`, not `/dashboard`.
- Regular users continue landing on `/dashboard`.