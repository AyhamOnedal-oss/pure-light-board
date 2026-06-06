## Plan

1. **Stop using hidden React Router state for this email flow**
   - Change the login-notification email CTA from `/dashboard/settings/account?changePassword=1` to `/login?redirect=/dashboard/settings/account%3FchangePassword%3D1`.
   - This makes the intended destination visible in the URL, so it survives published-site redirects and direct email opens.

2. **Teach the login page to honor the redirect query**
   - In `LoginPage`, read `redirect` from the login URL.
   - After successful sign-in, navigate to that redirect when it is a safe internal path.
   - Keep the current super-admin behavior so admins still go to `/admin`.

3. **Keep the current account password modal behavior**
   - The account page already opens the old-password/new-password modal when it receives `?changePassword=1`.
   - No new reset page is needed for this specific “تغيير كلمة المرور” button; it should land on the authenticated account page modal.

4. **Deploy the updated login-notification function**
   - Redeploy only the changed email function so new emails contain the corrected login URL.