## What’s happening

The email `w8jkkchmfb@zam-partner.email` exists in Supabase Auth and is confirmed, so the app should not show “هذا البريد الإلكتروني غير مسجل”.

The likely issue is on the frontend forgot-password screen, not the database: the reset flow should not try to prove whether an email exists from the browser. Supabase intentionally avoids exposing that for security, and the existing edge function already returns `{ ok: true }` even when no user is found.

## Plan

1. Update the forgot-password form behavior
   - Normalize the typed email the same way login does.
   - Stop showing “email not registered” for reset requests.
   - Show the “check your email” success screen after a valid email is submitted, unless the edge function itself fails unexpectedly.

2. Harden the reset request handling
   - Make `sendPasswordReset()` treat the edge function response as successful when the request completes.
   - Only surface real network/function errors, not “user not found” style messages.

3. Verify the specific account path
   - Test/reset-call the deployed `send-password-reset` function for `w8jkkchmfb@zam-partner.email`.
   - Check logs if the request does not reach the function.

## Technical notes

- The account is present in `auth.users`:
  - email: `w8jkkchmfb@zam-partner.email`
  - confirmed: yes
  - deleted: no
- This is not caused by Saudi vs Jordan location.
- The reset UX should avoid email-enumeration: for any valid email format, the UI should say “check your email” even if the email is not registered.