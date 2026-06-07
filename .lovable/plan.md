## Goal
Never send the English "Your Zid/Salla store is now linked to Fuqah AI" email. Only the existing Arabic welcome email (for newly provisioned merchants) should ever be sent from the OAuth provisioning flow.

## Change
In `supabase/functions/_shared/provision-merchant.ts`:

- Keep the Arabic welcome email path for **new users** exactly as-is (`welcomeHtml(...)` via Resend).
- For **existing users** (the "linked" branch), remove the English email send entirely. No Resend call, no English template. The function still returns the resolved `tenantId`/`userId` so the OAuth callback continues to update `zid_connections` / `settings_workspace` and redirect the merchant to the dashboard.
- Remove the now-unused `linkedEmailHtml(...)` helper from the same file.

No other files change. The Arabic template file, OAuth callbacks, and redirect behavior stay the same. Existing merchants who reinstall will simply be linked silently and land on the dashboard without receiving any email.
