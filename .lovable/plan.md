## What's actually happening

Looking at `zid_events`, the last install did this:

1. Zid callback succeeded, found store email `dfolxp9bgd@zam-partner.email`.
2. `provisionMerchantAccount` ran — user already existed, tenant was resolved (`tenant_resolved: true`).
3. Resend rejected the email: **`403 — The fuqah.net domain is not verified`**, so no credentials were sent.
4. Because `tenantId` got resolved, the callback redirected to `/dashboard/settings/store?connected=zid` — but the merchant has **no browser session**, so `RequireAuth` bounces them and you land on a blank/"not found" looking page.

So two bugs:

- **A. Wrong redirect target** — after a fresh OAuth install the merchant is never logged in in this browser tab, regardless of whether their account already exists. We must always send them to `/login` with the email prefilled and a clear "we sent you a password" banner. The only thing the merchant should ever see post-install is the sign-in screen.
- **B. Resend "from" address (`noreply@fuqah.net`) is not a verified domain in your Resend account.** Resend only allows sending from verified domains. That's why no email arrives.

## Fix

### 1. Edge functions — always redirect to /login

In `supabase/functions/zid-oauth-callback/index.ts` and `supabase/functions/salla-oauth-webhook/index.ts`, remove the "if tenantId then go to /dashboard" branch. After provisioning, always:

```
/login?from=zid&email={storeEmail}&status={new|linked}
```

(`status=new` when a fresh password was emailed, `status=linked` when the user already existed and only got a "linked" notice.)

### 2. LoginPage banner

Update `src/app/components/LoginPage.tsx` to read `status` too and show a stronger Arabic-first banner:

- `status=new`: "تم ربط متجرك بنجاح. أرسلنا كلمة مرور مؤقتة إلى بريدك {email}. يرجى التحقق من البريد الوارد (والمزعج) ثم تسجيل الدخول."
- `status=linked`: "تم ربط متجرك بحسابك الحالي. سجّل الدخول باستخدام كلمة المرور الخاصة بك."

Plus a "Resend password" link that calls `sendPasswordReset(email)` so the merchant can recover if the email got lost.

### 3. Resend domain

`RESEND_FROM_EMAIL` is currently `noreply@fuqah.net` (or similar on `fuqah.net`) and that domain is **not verified** in your Resend dashboard. Two options — pick one before we deploy:

```text
Option A (recommended): verify fuqah.net (or fuqah.ai) in Resend
   → https://resend.com/domains → Add domain → add the DNS records → wait for "Verified"
   → keep RESEND_FROM_EMAIL = noreply@fuqah.net

Option B (quick test only): use the Resend sandbox sender
   → set RESEND_FROM_EMAIL = onboarding@resend.dev
   → BUT Resend will only deliver to the email address that owns the Resend account; real merchants will not receive it. Not usable in production.
```

### 4. Better logging

In both callbacks, when Resend returns non-OK, also write a `oauth.email_failed` event with the merchant email and Resend error so we can see failures from the dashboard without re-checking the function logs.

## Files touched

- `supabase/functions/zid-oauth-callback/index.ts`
- `supabase/functions/salla-oauth-webhook/index.ts`
- `supabase/functions/_shared/provision-merchant.ts` (return Resend error so caller can log it)
- `src/app/components/LoginPage.tsx`

## One question before I implement

Which Resend "from" do you want? Please confirm one of:

1. I'll keep `noreply@fuqah.net` — you'll verify the domain in Resend now.
2. Use `noreply@<another-domain-you-already-verified>` — tell me the domain.
3. Temporarily switch to `onboarding@resend.dev` just to test the flow end-to-end (won't work for real merchants).
