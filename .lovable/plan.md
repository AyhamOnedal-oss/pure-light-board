# Login Notification Email + Change Password from Dashboard

Two features:
1. Every successful sign-in sends the user the Arabic "تسجيل دخول جديد إلى حسابك" email shown in the mockup.
2. Users can change their password from inside the dashboard (Account Settings), with the email CTA deep-linking there.

---

## 1. Login Notification Email

**Infrastructure:** Use Lovable's built-in email system on the existing `support@fuqah.net` / `fuqah.ai` setup. No third-party provider. Steps performed automatically:
- Verify email domain status; if app email infra/templates aren't scaffolded yet, set them up (`setup_email_infra` + `scaffold_transactional_email`).
- Add a new React Email template `login-notification.tsx` in `supabase/functions/_shared/transactional-email-templates/` matching the mockup exactly:
  - Dark navy header (`#043CC8`-family) with lock icon and "تسجيل دخول جديد إلى حسابك"
  - Arabic greeting using `store_name`
  - Info card with rows: 📅 التاريخ, 🕐 الوقت, 📦 حالة الباقة
  - Yellow warning box about changing password if it wasn't them
  - Primary CTA button "تغيير كلمة المرور" → `https://<app>/dashboard/settings/account?changePassword=1`
  - Footer: 🌐 www.fuqah.ai · 📧 support@fuqah.ai
  - RTL `dir="rtl"`, IBM Plex Sans Arabic / Arial fallback
- Register it in `registry.ts` and deploy `send-transactional-email`.

**Trigger:** New thin edge function `send-login-notification` (auth-required) that:
- Validates the caller's JWT, resolves their tenant, pulls `store_name` from `settings_workspace`, `package_status` from `settings_plans`, formats date/time in Arabic for Asia/Riyadh.
- Invokes `send-transactional-email` with `templateName: 'login-notification'`, an idempotency key like `login-<user_id>-<timestamp_minute>` to avoid duplicates from token refresh.

**Client wiring:** In `LoginPage.handleLogin` success branch (and only there — not on token refresh), fire-and-forget `supabase.functions.invoke('send-login-notification')`. Errors are swallowed so login UX isn't blocked.

---

## 2. Change Password from Dashboard

**Location:** `src/app/components/settings/AccountSettings.tsx` — add a new "الأمان / Security" section:
- Current password
- New password (rules reused from `ResetPasswordPage`: min 8, upper, lower)
- Confirm new password
- Eye toggles, inline validation, live strength hints
- Submit button "تحديث كلمة المرور"

**Logic:**
- Verify current password via `supabase.auth.signInWithPassword({ email, password: current })`.
- On success → `supabase.auth.updateUser({ password: new })`.
- Show success toast; clear fields.
- Secondary link "نسيت كلمة المرور الحالية؟" → calls existing `sendPasswordReset(user.email)` and toasts that an email was sent.

**Deep-link from email:** If URL contains `?changePassword=1`, auto-scroll to the section and focus the current-password input.

---

## Files

New:
- `supabase/functions/_shared/transactional-email-templates/login-notification.tsx`
- `supabase/functions/send-login-notification/index.ts`

Edited:
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (register template)
- `supabase/config.toml` (register new function)
- `src/app/components/LoginPage.tsx` (invoke notification on successful sign-in)
- `src/app/components/settings/AccountSettings.tsx` (password change section + deep-link)

No DB schema changes. No new secrets required (LOVABLE_API_KEY already present).
