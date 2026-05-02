## Problem

OAuth token exchange now succeeds (we got past the Zid authorize screen and back to our callback with a `code`), but the callback redirects with `zid_error=no_store_uuid`. That means:

1. The `code → token` POST to `https://oauth.zid.sa/oauth/token` worked.
2. We then call `GET https://api.zid.sa/v1/managers/account/profile` with the returned tokens.
3. We can't find `store.uuid` in the response and bail out.

The `zid_events` table has no row capturing what the profile endpoint actually returned, so we're guessing at the shape. We need to log it.

## Fix

Update `supabase/functions/zid-oauth-callback/index.ts`:

1. **Always log the profile response** (status + JSON body, truncated) to `zid_events` as `oauth.profile_response` BEFORE deciding to bail. This gives us ground truth about what Zid sends back.

2. **Also log the token response shape** (keys only, never values) as `oauth.token_response_keys` so we can confirm we picked the right `authorization` / `manager_token` fields.

3. **Broaden `store_uuid` extraction** to walk the response and pick up any of these common Zid shapes:
   - `user.store.uuid`
   - `data.user.store.uuid`
   - `data.store.uuid`
   - `store.uuid`
   - `uuid` at root if it looks like a store object
   - `data.uuid`

4. **Add a fallback endpoint**: if the profile call returns 200 but we still can't find a uuid, call `GET https://api.zid.sa/v1/managers/store/info` (or `/v1/store`, depending on what the logged response suggests) using the same Bearer + `X-Manager-Token` headers, and try the same extraction there.

5. **Soft-fail instead of hard-fail when we have tokens but no uuid yet**: still upsert the connection row keyed on the tokens (without store_uuid) into a temporary record, but for now keep the redirect to the error page so we can see the new event log.

## After deploy

You click تثبيت التطبيق again. Then I read the new `oauth.profile_response` row from `zid_events`, see the actual JSON Zid returned, and either confirm the broadened extraction worked or pinpoint the exact JSON path / endpoint we need.

## Files

- `supabase/functions/zid-oauth-callback/index.ts` — add logging + broaden extraction + fallback endpoint.

No DB schema changes, no client changes.
