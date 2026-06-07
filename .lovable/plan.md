### Goal
Make the Arabic password reset email button open the app’s `/reset-password` page directly with recovery tokens preserved, so the user always sees the new-password fields instead of landing on `lovable.dev/auth-bridge` or a blank bridge page.

### Plan
1. Update `supabase/functions/send-password-reset/index.ts`
   - Keep sending only the custom Arabic email.
   - Stop placing Supabase’s raw `action_link` directly in the Arabic email button, because that link currently routes through `lovable.dev/auth-bridge`.
   - Extract the token/hash portion from Supabase’s generated recovery link.
   - Build the email button URL as: `https://<app-origin>/reset-password#access_token=...&refresh_token=...&type=recovery...`
   - This keeps Supabase recovery credentials while bypassing the bridge page.

2. Harden fallback behavior
   - If token extraction fails for any reason, fall back safely to the original generated link rather than breaking email delivery.
   - Continue returning `ok: true` to avoid email enumeration.

3. Update `src/app/components/ResetPasswordPage.tsx`
   - Recognize recovery tokens arriving in either `hash` or query params.
   - If the page is opened through `/auth-bridge` or with bridge-style params, redirect/normalize to `/reset-password` while preserving tokens.
   - Keep the expired/single-use link message and “طلب رابط جديد” button for reused links.

4. Validate the flow
   - Confirm the login “forgot password” flow still calls `send-password-reset` with `/reset-password` as `redirectTo`.
   - Verify the reset page renders the password fields when tokens are present, and shows the expired-link state when tokens are absent or invalid.