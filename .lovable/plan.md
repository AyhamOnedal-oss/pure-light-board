## Plan

1. **Update login-notification email** (`supabase/functions/send-login-notification/index.ts`)
   - Add a small Arabic note above the CTA: "ستحتاج إلى تسجيل الدخول أولاً" so users aren't surprised by the login screen.
   - Add a secondary link below the main button: "نسيت كلمة المرور؟ إعادة التعيين عبر البريد" pointing to `/login?forgot=1&email=<recipient-email>` for users who don't remember their current password.

2. **Login page** (`src/app/components/LoginPage.tsx`)
   - Read `?forgot=1` and `?email=` from the URL.
   - When `forgot=1` is present, switch the view to the forgot-password form on mount and pre-fill the email input.

3. **Deploy** the updated `send-login-notification` edge function.

No changes to `/reset-password` (token-based flow is already correct) and no changes to the authenticated change-password modal.