## Root cause

Zid only supports **Authorization Code OAuth** (confirmed from docs.zid.sa/authorization). There is no "easy mode".

Your Zid Partner Dashboard has the **App URL** pointing at the OAuth callback. When a merchant clicks "Subscribe" in the App Market, Zid opens the App URL *with no `?code`* — it's just "launch app", not an OAuth redirect. Our callback then hits its "no code" branch and bounces to `?zid_error=missing_code`. The actual OAuth `/oauth/authorize` step never ran.

## Fix (two parts)

### Part A — Code change: add a public install entry point

Create a new edge function `zid-oauth-install` that:
1. Reads optional `state` from query (tenant_id if present).
2. Builds the Zid authorize URL:
   ```
   https://oauth.zid.sa/oauth/authorize
     ?client_id=<ZID_CLIENT_ID>
     &redirect_uri=<SUPABASE_URL>/functions/v1/zid-oauth-callback
     &response_type=code
     &state=<state>
   ```
3. 302-redirects the browser there.

This becomes the new **App URL** in the Partner Dashboard. From the merchant's perspective: click Subscribe → Zid opens our install function → instantly bounced to `/oauth/authorize` → approve → back to our callback with `?code` → tokens exchanged → upserted into `zid_connections` → redirect to login/dashboard.

Also: improve the callback's `missing_code` redirect to land on a public, non-auth-gated page that explains the issue (right now `/dashboard/settings/store` 404s/redirects to login because the user isn't signed in yet).

### Part B — You update the Zid Partner Dashboard

After I deploy the install function, change in https://partner.zid.sa → your app:

1. **App URL** → set to:
   ```
   https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-oauth-install
   ```
2. **Redirect URL (callback)** → keep as:
   ```
   https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-oauth-callback
   ```
3. **Scopes** → tick the ones your app needs (orders, products, etc.).
4. Save & republish the app version.
5. Uninstall from your dev store, click Subscribe again — this time you'll see the Zid permissions screen, then land in our app connected.

## Files I'll touch

- **New**: `supabase/functions/zid-oauth-install/index.ts` (~30 lines, just builds URL and 302s).
- **Edit**: `supabase/functions/zid-oauth-callback/index.ts` — change the `missing_code` redirect to a clearer public error URL, and log the no-code attempt to `zid_events` for debugging.
- **Edit**: `supabase/config.toml` — register the new function (verify_jwt=false since it's public).

## What I'll verify after

1. `curl` the install function → confirm it 302s to oauth.zid.sa with correct params.
2. After you reinstall on your dev store, check `zid-oauth-callback` logs for a real `?code=` hit, and confirm a row appears in `zid_connections` with `connection_status='connected'`.

Approve and I'll implement.