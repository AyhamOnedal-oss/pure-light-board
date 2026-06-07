## Diagnosis
The reset-password route and component exist in the published bundle, and the email button reaches `/reset-password` with Supabase recovery tokens in the URL hash. The blank page is likely caused by frontend startup/auth URL parsing failing before the reset form can render, leaving no visible fallback.

## Plan
1. Add a small route-level error fallback so `/reset-password` never renders a completely blank page if React/router/auth startup throws.
2. Harden `ResetPasswordPage` so it:
   - parses recovery tokens immediately from both hash and query;
   - shows the reset form as soon as tokens are present;
   - does not wait indefinitely on Supabase session restoration;
   - keeps a visible invalid/expired-link state for failed links.
3. Adjust the Supabase client auth options for this app’s custom recovery flow to prevent Supabase’s automatic URL parsing from racing with the reset page’s explicit token handling.
4. Keep the email link format unchanged unless the above still exposes a redirect/session issue; then normalize the edge-function redirect to always land on `/reset-password#...` with tokens.

## Files to update
- `src/integrations/supabase/client.ts`
- `src/app/components/ResetPasswordPage.tsx`
- `src/app/routes.tsx`

## Verification
After implementation, test the reset URL shape shown in the screenshot by loading `/reset-password#access_token=...&refresh_token=...&type=recovery` and confirm the reset form appears instead of a blank page.