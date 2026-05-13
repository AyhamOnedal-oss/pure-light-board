## What you asked for

1. Tickets you raise from the widget don't appear in the dashboard tickets list.
2. The sidebar user card always shows `admin@store.com` and a hardcoded name — it should show the real signed-in user's email and the store name from the API.
3. The dashboard home page sometimes times out and shows "Not found" — need consistent hosting.
4. In Settings → Store Info → النطاق (domain), the value must be auto-filled from the OAuth payload, not typed by hand.
5. In Supabase `zid_connections`, `store_name` and `store_url` are NULL even though they exist in Zid's payload — fix extraction.
6. Remove the entire الاتصالات (Connections) page — it was never requested.

## Plan

### 1. Remove Connections entirely
- Delete `src/app/components/settings/Connections.tsx`.
- Remove its import and the `settings/connections` route from `src/app/routes.tsx`.
- Remove the الاتصالات sidebar entry in `src/app/components/Layout.tsx` (line 87).

### 2. Sidebar user card — real identity
In `src/app/components/Layout.tsx`:
- Replace hardcoded `Ahmed Hassan` / `admin@store.com` / `AH` initials with live data:
  - Email: `supabase.auth.getUser()` → `user.email`.
  - Display name: read `settings_workspace.name` for the current tenant (the workspace name is set from the store name during OAuth provisioning), falling back to `settings_account.display_name`, then to the email prefix.
  - Initials: derived from the resolved name.
- Wire through `AppContext` if a hook already exposes the user; otherwise add a small `useEffect` that loads once.

### 3. Auto-fill store domain + fix zid_connections name/url extraction
Root cause for both: the Zid profile parser in `supabase/functions/zid-oauth-callback/index.ts` only checks a fixed set of paths (`b.user.store.name`, `b.data.store.name`, …). Zid actually returns the store under different keys depending on which endpoint succeeded (e.g. `b.data.profile.name`, `b.data.store_name`, `b.results[0].name`, etc.), so the values fall through to `null` and never reach the row.

Changes in `zid-oauth-callback/index.ts`:
- Generalize the extractor: write a `findFirst(obj, candidateKeys[])` that recursively walks the JSON and returns the first non-empty string match for any of the candidate keys. Use it for:
  - `storeName`: `["name", "store_name", "title", "shop_name"]`
  - `storeUrl`: `["store_url", "url", "domain", "site_url", "shop_url"]`
  - `storeEmail`: `["email", "store_email", "owner_email"]`
- Keep the existing explicit paths as a fast-path, then fall back to the recursive finder.
- Persist the resolved domain to `settings_workspace.domain` during the same upsert (currently we only set `zid_store_uuid` + `platform`). Derive `domain` from `storeUrl` (strip protocol/path) so Settings → Store Info shows it without manual entry.
- Mirror the same change in `supabase/functions/salla-oauth-webhook/index.ts` so Salla also populates `domain` automatically.

Frontend in `src/app/components/settings/StoreInfo.tsx`:
- The component already loads `domain` from `settings_workspace`. After the backend change above, the field will populate automatically on next OAuth install / reload.
- Make the domain input read-only (with a small "auto-detected from your store" helper) so merchants don't accidentally overwrite it.

### 4. Tickets raised in widget not showing in dashboard
Most likely cause: the widget is posting tickets with a different `tenant_id` than the one you're signed into (numeric Salla/Zid store id resolves to a different workspace, or `tenant_exists()` matches a stale tenant). Plan:
- Add a one-off diagnostic query: pull the latest 5 rows from `tickets_main` ordered by `created_at desc` and compare `tenant_id` against your current workspace id. (I'll run this with `supabase--read_query` once the plan is approved.)
- If the ticket exists under a different tenant, fix `widget-resolve` so the resolved tenant matches the one the OAuth install created (i.e. the same `settings_workspace.id` that owns the `zid_connections` / `salla_connections` row for that store).
- If no row exists at all, the widget's `tickets_main` insert is silently failing the `tickets_anon_insert_widget` RLS check — log the insert response in the widget and surface the error.

### 5. Dashboard "Not found" timeout
This is the published Lovable host returning a 404 fallback when the SPA route is requested directly (e.g. after a refresh on `/dashboard`). The SPA uses `react-router` BrowserRouter and the host doesn't have an SPA-fallback rule for unknown paths.

Plan:
- Add a `public/_redirects`-style fallback so any unmatched path serves `index.html` (the Lovable host honours this convention). Concretely: ship `public/_redirects` with `/* /index.html 200`.
- Verify by hard-refreshing `/dashboard` on the published URL after deploy.

### Out of scope
- No changes to widget styling, chat AI, plans, or admin pages.
- No schema migrations needed unless the diagnostic in step 4 reveals one.

### Files touched
- `src/app/routes.tsx` — remove Connections route + import.
- `src/app/components/Layout.tsx` — remove sidebar item, real user card.
- `src/app/components/settings/Connections.tsx` — deleted.
- `src/app/components/settings/StoreInfo.tsx` — read-only domain hint.
- `supabase/functions/zid-oauth-callback/index.ts` — robust extractor + write `domain`.
- `supabase/functions/salla-oauth-webhook/index.ts` — write `domain`.
- `public/_redirects` — SPA fallback.
- (Conditional) `widget-resolve` / widget ticket insert logging after diagnostic.

Approve to implement.