## What is happening

The reset email link is working: it reaches `/reset-password` with valid Supabase recovery tokens in the URL. The blank page is caused by the app not reliably restoring/rendering the recovery session before the reset form appears.

## Plan

1. **Make the reset page parse the recovery URL explicitly**
   - On `/reset-password`, detect `access_token`, `refresh_token`, and `type=recovery` from the URL hash.
   - Call Supabase session setup directly from those tokens instead of waiting only for the auth listener/timer.

2. **Show the password form as soon as recovery is valid**
   - Keep the existing Arabic/English reset password UI.
   - If the recovery session is valid, render the new-password and confirm-password fields.
   - If the link is expired/invalid, show the existing “request a new reset link” message.

3. **Clean the URL after the session is restored**
   - Remove the long token hash from the browser address bar after Supabase stores the recovery session.
   - This avoids leaving sensitive tokens visible in the URL.

4. **Keep submit behavior unchanged**
   - Continue using `supabase.auth.updateUser({ password })`.
   - Continue normalizing the password before update.
   - Sign the user out after a successful reset and send them back to login.

## Technical notes

- The fix should be limited to `src/app/components/ResetPasswordPage.tsx` unless implementation shows a route-level adjustment is needed.
- No database change is needed.
- No Supabase auth setting change is needed.