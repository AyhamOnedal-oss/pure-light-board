## Problem

Clicking **تسجيل الدخول** in the invite email opens `/login?email=...&invite=1`. Today, if the browser already has a session for the invited email (e.g. the invitee previously signed in on that device, or simply reopened the link), `LoginPage` treats it as "same user" and immediately redirects to `/dashboard` — no password is ever entered.

The user wants the invite link to always require an explicit password sign-in.

## Fix

Edit `src/app/components/LoginPage.tsx` only — pure frontend behavior change.

1. **Always sign out on invite link arrival.** In the `isInviteLink` effect, remove the "sameUser → skip signOut" short-circuit. Whenever the page is loaded with `?invite=1`, call `supabase.auth.signOut()` once, then render the login form with the email pre-filled and the password field empty.

2. **Block auto-redirect for invite links.** In the "already signed in → bounce to dashboard" effect, if `isInviteLink` is true, never auto-redirect based on an existing session. Only redirect after the user submits the form (i.e. after `handleLogin` succeeds).

3. **Clear the `invite=1` flag after a successful manual sign-in.** Inside `handleLogin`'s success branch, strip `invite` and `email` from the URL via `history.replaceState`, so any subsequent in-app navigation behaves normally and a later refresh of `/dashboard` doesn't re-trigger the forced sign-out.

4. **Guard with a one-shot ref.** Use a `useRef` flag so the forced sign-out runs at most once per page load, preventing a sign-out/redirect loop if React re-runs the effect.

No changes to the edge function, the email template, routing, RLS, or the database. The invite URL stays `/login?email=<email>&invite=1`.

## Verification

- Open the invite email link while already logged in as the invitee → login form appears, email pre-filled, password empty; entering the wrong password shows the error; entering the right password lands on `/dashboard`.
- Open the link while logged in as the admin (different email) → same behavior (already works today, must keep working).
- Open the link while logged out → login form appears, no console errors.
- After successful sign-in, refresh `/dashboard` → stays signed in, no forced sign-out.
