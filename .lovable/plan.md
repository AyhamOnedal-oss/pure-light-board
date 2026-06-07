## Plan

Fix the password reset page so recovery links open directly to the new-password form instead of a blank/invalid state.

### What I found
- The published `/reset-password` route is loading the app bundle correctly.
- The app currently waits for Supabase `setSession()` / `getSession()` before showing the form.
- Recovery links generated through Supabase can have tokens that the page sees in the URL, but the browser session restoration can fail or be consumed before the component finishes checking. That makes the page show invalid/blank instead of the reset form.

### Implementation
1. Update `src/app/components/ResetPasswordPage.tsx` so if the URL hash contains `type=recovery` with `access_token`, the page immediately treats the link as a recovery flow and renders the two password fields.
2. Keep the session setup in the background using `supabase.auth.setSession(...)`, but do not block the form UI on it forever.
3. On submit, retry session restoration from the captured URL tokens right before `supabase.auth.updateUser({ password })`, so the password update uses the recovery session.
4. Improve the failure message only when the password update itself fails, telling the user to request a new link.
5. Keep the route public and avoid changing Supabase settings or database schema.

### Expected result
A valid reset URL like `/reset-password#access_token=...&refresh_token=...&type=recovery` will show exactly the new password and confirm password fields, then update the password and return the user to login.