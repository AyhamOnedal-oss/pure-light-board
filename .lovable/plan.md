## The actual security/UX bug

When a merchant lands back on the app from the Zid OAuth install (`/?oauth_result=install_success&email=NEW@store...`), the SPA does NOT clear any existing browser session. If a previous account (e.g. the Test 12 owner `aj1vxofkqc@…`) was signed in on that browser, the LoginPage's "already signed in → /dashboard" effect fires instantly and drops the visitor into the previous tenant's workspace without entering any credentials.

Concretely, in `src/app/components/LoginPage.tsx` lines 90-101:

```ts
useEffect(() => {
  if (!authLoading && !roleLoading && session) {
    navigate(isSuperAdmin ? '/admin' : '/dashboard', { replace: true });
  }
}, [...]);
```

This runs even when `?oauth_result=install_success` is in the URL, so the "check your email" screen is bypassed and the visitor lands in whatever tenant the stale session belongs to.

There is no actual cross-tenant data leak — RLS still scopes data to the signed-in user — but the experience looks like one, and it can let a previous user on a shared device reach a workspace they no longer should access without re-authenticating.

## Fix plan

1. **Force sign-out on install landing**
   - In `src/app/routes.tsx` `RootEntry` (and `LoginPage`), if `oauth_result=install_success` is present in the URL, call `supabase.auth.signOut()` once before rendering, then clean the URL’s session-y params. This guarantees a clean slate for the new install.

2. **Stop auto-redirect while install-success screen is showing**
   - In `LoginPage.tsx`, gate the "already signed in" auto-navigate effect on `!showInstallSuccess`. Even if a session re-appears mid-render, the merchant must explicitly hit "Continue to Sign In" and enter their new credentials.

3. **Reset session-derived state**
   - After the forced sign-out, also clear `tenantId` and any cached values that the previous user could leak via UI flicker. The existing `signOut()` in `AppContext` already does this; we just need to make sure the install flow uses it.

4. **Tighten the OAuth callback redirect**
   - Keep the `email` query param (used only as a UI prefill, not a credential).
   - Do not add tokens, passwords, or `access_token` fragments to the redirect URL (already the case — confirm and document).

5. **Optional hardening (recommend, not implement unless approved)**
   - Add a short-lived, single-use `install_token` issued by `zid-oauth-callback`, validated by a small `claim-install` edge function, so the install-success screen can prove it came from a real OAuth round-trip. This blocks anyone from crafting `/?oauth_result=install_success&email=victim@…` to phish the "check your email" screen.

## Files to touch

- `src/app/routes.tsx` — `RootEntry` calls `supabase.auth.signOut()` when `oauth_result` is present.
- `src/app/components/LoginPage.tsx` — gate the auto-redirect effect on `!showInstallSuccess`, ensure the install screen always wins when an `oauth_result` param is present.
- `src/app/context/AppContext.tsx` — expose a small `forceSignOut()` helper (or reuse `signOut()`).

## Validation

- Sign in as User A on the published origin → install a new Zid store whose email is User B → confirm you land on the "Check your email" screen for User B and **not** in User A's `/dashboard`.
- Sign out completely → repeat the install flow → confirm same screen, no auto-redirect.
- Sign in as User A normally (no `oauth_result`) → confirm normal redirect to `/dashboard` is unchanged.
- Super admin login → confirm redirect to `/admin` is unchanged.