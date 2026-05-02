## Goal

After a merchant installs on Zid or Salla, auto-create their Supabase auth account using the **store email** from the platform, generate a random password, email it via **Resend**, and on first login link the existing connection row to their tenant.

## Flow (identical for Zid & Salla)

```text
Merchant clicks Install on Zid/Salla
  → OAuth callback exchanges code, fetches profile (already working)
  → upsert {store_uuid/store_id, store_email, tokens} into connections table
  → IF store_email present and tenant not yet linked:
      a. Look up auth.users by email
      b. If new: generate 16-char password
                 admin.createUser({ email, password, email_confirm: true,
                   user_metadata: { display_name: storeName, source: platform } })
                 (handle_new_user trigger auto-creates tenant + membership)
      c. Resolve user's tenant from auth_tenant_members
      d. Update connection row with tenant_id; update settings_workspace
         with platform + store_uuid/store_id
      e. Send Resend email:
         - new user → "Your {Zid|Salla} store is connected. Login: {email} / Temporary password: {pw}"
         - existing user → "Your {Zid|Salla} store has been linked to your account."
  → Redirect to /login?from={zid|salla}&email={store_email}

On /login:
  → Pre-fill email from ?email= param
  → Show banner: "We've emailed your login details to {email}"
  → Standard signInWithPassword → /dashboard
```

## Changes

1. **New shared module** `supabase/functions/_shared/provision-merchant.ts`
   - `provisionMerchantAccount({ email, platform, storeName })` → `{ tenantId, isNewUser, generatedPassword? }`
   - Uses `auth.admin.listUsers` (filter by email), `auth.admin.createUser`
   - Reads tenant from `auth_tenant_members` (most recent owned)

2. **New shared module** `supabase/functions/_shared/send-resend-email.ts`
   - Thin `fetch` wrapper to `https://api.resend.com/emails`
   - Two templates baked in: `merchant_welcome_new`, `merchant_store_linked`
   - Bilingual (EN + AR) body matching the app's brand

3. **`zid-oauth-callback/index.ts`** — after upsert when `tenantId` is null and `storeEmail` is set, call `provisionMerchantAccount`, update the connection's `tenant_id`, update `settings_workspace`, send email, redirect to `/login?from=zid&email=…`.

4. **`salla-oauth-webhook/index.ts`** — same wiring (uses `salla_connections.store_id`).

5. **`src/app/components/LoginPage.tsx`** — read `?email=` and `?from=` from query string; pre-fill email field; show a one-line banner above the form when `from=zid|salla`.

6. **Secrets** — add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (e.g. `noreply@yourdomain.com`).

## Open question

What "from" address should I use for the Resend email? It must be on a domain you've **verified in Resend** (you mentioned you already have your domain set up). Example: `noreply@fuqah.ai` or `hello@yourdomain.com`.

Once you approve, I'll ask you to add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as secrets, then implement.
