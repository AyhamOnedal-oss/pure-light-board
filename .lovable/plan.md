## Goal
Allow signing in as different accounts in different browser tabs of the same browser, without one tab's login hijacking another.

## Root cause
`src/integrations/supabase/client.ts` configures the Supabase client with `storage: localStorage`. `localStorage` is shared across all tabs of the same origin, and supabase-js also fires `onAuthStateChange` across tabs via the storage event. So signing in on tab B overwrites tab A's session and tab A's `AppContext` listener immediately swaps to the new user.

## Fix — per-tab session isolation

Switch the auth client to a **tab-scoped storage** so each tab keeps its own session, while keeping "remember me across reloads" behavior for that same tab.

### 1. `src/integrations/supabase/client.ts`
- Replace `storage: localStorage` with a small custom `Storage` adapter that:
  - Reads/writes under a per-tab key prefix held in `sessionStorage` (e.g. `fuqah_tab_id` → random uuid generated once per tab; `sessionStorage` is naturally per-tab and survives reloads).
  - Backing store is still `localStorage` (so a tab reload restores its own session), but keys are namespaced as `sb-<tabId>-<originalKey>`.
  - On tab close, optionally GC its namespace (best-effort, via `beforeunload`).
- Also set `multiTab: false` semantics by ignoring cross-tab `storage` events — supabase-js v2 honors the custom storage and won't sync if keys differ per tab, so no extra flag needed. Confirm no `BroadcastChannel`-based sync is enabled (default is off in v2).

### 2. `src/app/context/AppContext.tsx`
- No logic change required; the existing `onAuthStateChange` listener will now only react to this tab's session.
- Remove/skip the "TOKEN_REFRESHED with no session → redirect" branch only if it misfires under the new storage; otherwise leave as-is.

### 3. `auth-attacher.ts` and other helpers
- They call `supabase.auth.getSession()` which goes through the same client, so they automatically pick the tab-scoped session. No change.

### 4. Edge cases to handle
- **New tab opened via Ctrl/Cmd+Click or "Duplicate tab":** `sessionStorage` is copied for duplicated tabs in some browsers; generate the tab id lazily and, if a session already exists under that id from another live tab, mint a fresh id so the new tab starts logged-out (detect via a heartbeat key in `localStorage` keyed by tabId that's refreshed every few seconds).
- **Password reset / OAuth redirect flows:** these land in a fresh tab — they'll get their own tabId and their own session, which is the desired behavior.
- **Sign-out:** only clears this tab's namespaced keys; other tabs stay signed in.
- **Storage quota / cleanup:** add a `beforeunload` handler that removes this tab's keys from `localStorage` so abandoned tabs don't pile up. Reloads use `pagehide` with `persisted` check to avoid wiping on reload.

## Out of scope
- No DB changes.
- No changes to `RequireAuth`, `RequirePermission`, `LoginPage`, edge functions, or the invite/delete flows fixed previously.

## Verification
1. Open the app in two tabs.
2. Sign in as admin in tab A → tab A shows admin.
3. Sign in as `ayhamonedal@icloud.com` in tab B → tab B shows employee; tab A still shows admin after refresh.
4. Sign out in tab B → tab A unaffected.
5. Invite/deactivate/delete the employee from tab A and observe the effect in tab B in real-world timing.
