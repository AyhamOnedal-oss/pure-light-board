## Root cause

Your published site at `pure-light-board.lovable.app` is served as a plain Vite SPA. I verified this by hitting it directly:

- `GET /` → 200 (index.html, SPA boots)
- `GET /login` → 404 "Not Found"
- `GET /check-email` → 404 "Not Found"

So when Zid bounces the merchant back to `/check-email?...` or `/login?...`, the host returns 404 before React Router ever loads. That is why you see the bare "Not Found" page after approving the scopes — the OAuth itself succeeded; the redirect target just isn’t reachable as a deep link.

This is a hosting/SPA-fallback issue with the current React Router 7 SPA setup in this project, not a Zid scopes problem and not a code bug in `LoginPage`.

## What to change

### 1. Zid Partner Dashboard (no change needed)

Keep the Zid app config exactly as it is:

- App URL (install entry): `https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-oauth-install`
- Redirect URL (OAuth callback): `https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-oauth-callback`
- Webhook URL: `https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-oauth-webhook`

These point at Supabase functions and are correct. Do NOT change them to `pure-light-board.lovable.app/...` — Zid must call our edge function directly.

### 2. Edge function — redirect to `/` instead of `/check-email`

In `supabase/functions/zid-oauth-callback/index.ts`, change the final success redirect from `/check-email?...` to `/?...` and add an explicit marker so the SPA can recognize it:

```
${APP_BASE_URL}/?oauth_result=install_success&from=zid&store_uuid=...&email=...&status=new|linked
```

Same change for the error redirects: instead of `/dashboard/settings/store?zid_error=...`, use `/?oauth_result=install_error&zid_error=...`. `/dashboard/...` is also a deep link and will 404 for an un-logged-in browser tab too.

Then redeploy `zid-oauth-callback`.

### 3. SPA — handle the OAuth params at `/`

In `src/app/components/LoginPage.tsx` (and/or the root route in `src/app/routes.tsx`), add logic so that when the app loads on `/` with `?oauth_result=install_success&from=zid|salla&email=...&status=new|linked`, it:

- Renders the existing “check your email” success screen (already implemented in `LoginPage`).
- Pre-fills the email field.
- Shows the Arabic banner: «تم ربط متجرك بنجاح. أرسلنا كلمة مرور مؤقتة إلى بريدك …» for `status=new`, and the “linked” variant for `status=linked`.
- Does not auto-redirect to `/dashboard` (the merchant has no session in this tab).

This avoids the deep-link 404 entirely because `/` is the one path the host always serves.

### 4. Email links from `provision-merchant.ts`

Welcome / linked emails currently link to `/login?from=zid&email=...`. Change `loginUrl` in `supabase/functions/_shared/provision-merchant.ts` to:

```
${appBaseUrl}/?oauth_result=install_success&from=${platform}&email=${encodedEmail}
```

So clicking the email also lands on a working page even after a hard refresh / new device.

### 5. Salla callback — same pattern

`salla-oauth-webhook` is a server-to-server webhook so it doesn’t do a browser redirect today, but if/when we add a Salla browser callback, use the same `/?oauth_result=...` shape, not `/check-email` or `/login`.

### 6. Resend sender (already done)

`RESEND_FROM_EMAIL` is set to `onboarding@resend.dev` for now. Note: Resend’s sandbox sender will only deliver to the email address that owns the Resend account — real merchants will not receive anything until you verify a real domain (e.g. `fuqah.net`) in Resend and switch the secret back. This is unrelated to the 404 problem but is still required for production.

## Verification steps after deploy

1. `curl -I https://pure-light-board.lovable.app/?oauth_result=install_success&from=zid&email=test%40example.com&status=linked` → expect `200`.
2. Re-run the Zid install. After clicking تفعيل التطبيق, browser should land on `pure-light-board.lovable.app/?oauth_result=install_success&from=zid&...` and render the “check your email” screen with the email pre-filled.
3. Confirm a `zid_events` row of type `oauth.provision_merchant` exists with `email_sent: true` (only if your Resend account owns the merchant test email; otherwise expect `email_sent: false` — that’s the Resend sandbox limitation, not our bug).

## Files to edit

- `supabase/functions/zid-oauth-callback/index.ts` — redirect to `/?oauth_result=...` instead of `/check-email` / `/dashboard/...`.
- `supabase/functions/_shared/provision-merchant.ts` — update `loginUrl` to `/?oauth_result=...`.
- `src/app/components/LoginPage.tsx` (and `src/app/routes.tsx` if needed) — read `oauth_result` from `/` and show the success/check-email screen.
- Redeploy: `zid-oauth-callback` (and any other function importing the shared helper).