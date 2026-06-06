## Problems

1. The email CTA links to `/dashboard/settings/account?changePassword=1`. When the user isn't signed in, `RequireAuth` redirects to `/login` but only saves `location.pathname` — the `?changePassword=1` query is dropped. After login they land on `/dashboard/settings/account` with no modal, so it looks like they were sent to the main dashboard with no password screen.
2. The email footer text uses `fugah.ai` and `support@fugah.ai` instead of `fuqah.ai` / `support@fuqah.ai`.

## Fix

### 1. Preserve search params through the login redirect
- `src/app/components/RequireAuth.tsx`: change `state={{ from: location.pathname }}` → `state={{ from: location.pathname + location.search }}` so `?changePassword=1` survives the bounce to `/login`.
- `src/app/components/LoginPage.tsx`: the post-login redirect already uses `location.state.from` directly with `navigate(...)`, which accepts a path-with-search string, so no change needed there. Verify by tracing.

### 2. Auto-open the change-password modal on arrival
- `src/app/components/settings/AccountSettings.tsx` already reads `?changePassword=1` and opens the modal — no change. With fix (1) the param now actually reaches the page.

### 3. Fix the email footer typo
- `supabase/functions/send-login-notification/index.ts`: replace both `fugah.ai` strings (link text + mailto) with `fuqah.ai` / `support@fuqah.ai`. Redeploy the function.

## Files

Edited:
- `src/app/components/RequireAuth.tsx`
- `supabase/functions/send-login-notification/index.ts`

No new files, no DB or schema changes, no new secrets.
