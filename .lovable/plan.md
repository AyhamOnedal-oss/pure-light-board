## What is happening

The reset pages are not missing. The app is redirecting away because an authenticated session exists or because Supabase is falling back to the app root.

### 1. `إعادة التعيين عبر البريد`
This link currently opens:

```text
/login?forgot=1&email=...
```

`LoginPage` correctly reads `forgot=1` and starts in the forgot-password view. But the same component also has an auth effect that says: if there is already a session, navigate to `/dashboard`.

Because this email is usually opened in a browser where the user is already signed in, the forgot-password view is immediately replaced by the dashboard.

### 2. `إعادة تعيين كلمة المرور`
The password-reset email uses a Supabase recovery link. That link should authenticate a temporary recovery session and then land on:

```text
/reset-password
```

If Supabase does not accept the redirect URL, or if the recovery link lands on the app root with recovery tokens, the app route `/` immediately redirects to `/dashboard`. That is why the reset-password form is skipped.

## Best-practice fix

1. **Make forgot-password mode override dashboard auto-redirect**
   - When `/login?forgot=1` is present, `LoginPage` should not auto-send the user to `/dashboard`, even if a session already exists.
   - It should keep showing the email reset form.

2. **Make recovery links always route to `/reset-password`**
   - Add recovery-token detection at app entry.
   - If the URL contains Supabase recovery params, route to `/reset-password` and preserve the token/hash.
   - This protects against Supabase landing on `/` instead of `/reset-password`.

3. **Add a safety guard to `ResetPasswordPage`**
   - If the user opens `/reset-password` without a valid recovery session/token, show an Arabic message telling them the link is expired/invalid and offer to request a new reset email.
   - If a recovery session exists, show only new password + confirm password.

4. **Check Supabase redirect configuration**
   - Confirm the published URL allows this redirect:

```text
https://pure-light-board.lovable.app/reset-password
```

This may need to be added to Supabase Auth redirect allowlist if it is not already there.