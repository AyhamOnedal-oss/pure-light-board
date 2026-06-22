## What's actually broken (verified)

For tenant `d49382a6-4a0a-44e1-a2e0-fa500b1982d4` (Salla, merchant `1163458970`, store `demostore.salla.sa`):

- Saved design in DB is correct: `widget_outer_color = #dbe3f5`, updated 2026-06-22 20:27:08.
- Supabase `widget-bootstrap?platform=salla&external_id=1163458970` returns the correct tenant + saved cfg.
- **But the storefront loads the OLD static file** `https://widget.fuqah.net/widget.js?v=1` (Hostinger), with `data-store-id="1163458970"` and **no `data-platform`**. That legacy script calls `widget-bootstrap?platform=zid&external_id=1163458970&domain=demostore.salla.sa` → returns `tenant_id: null` → widget falls back to default black bubble.

This will break for **every Salla store** that has the legacy `widget.fuqah.net/widget.js` snippet installed, not just this one. It will also silently break any future store whose snippet is pasted without `data-platform`.

## Fix plan (server-side, no merchant action required)

The goal is: regardless of what snippet a merchant has pasted (old `widget.fuqah.net/widget.js`, new `widget-loader`, missing `data-platform`, wrong platform), the widget must resolve to the right tenant and render that tenant's saved design.

### 1. Harden tenant resolution — `supabase/functions/_shared/resolve-tenant.ts`

Make `resolveTenant` robust to a wrong/missing `platform`:

- If `platform` is missing, try BOTH `salla_connections.merchant_id` and `zid_connections.store_id/store_uuid` lookups using `store_id`.
- If `platform` is provided but the lookup misses, **fall back to the other platform** before giving up.
- If still no match, fall back to `domain` lookup against:
  - `settings_workspace.domain` (existing)
  - **NEW:** `salla_connections.store_url` host match (strip protocol, `www.`, trailing slash; match against `host` and `host + path-prefix` so subpath stores like `demostore.salla.sa/dev-xyz` work).
- Always return `is_active` from the matched connection row (not just `true`).

This single change fixes the current store and immunizes every future store against the wrong-platform snippet.

### 2. Harden `widget-loader` platform detection

In `supabase/functions/widget-loader/index.ts` `detectPlatform()`:

- If `data-store-id` is present but `data-platform` is missing, probe `window.salla` / `window.Salla` / `window.zid` and infer.
- If still ambiguous, send `platform=` empty and let the server resolve (which step 1 now supports). Also always include the current `location.hostname` as `domain=...` on the bootstrap call so the domain fallback can kick in.

### 3. Harden `widget-bootstrap`

- Always forward `domain` (from query or `Origin`/`Referer` header) to `resolveTenant`.
- When `resolveTenant` returns no tenant, log the input (platform, external_id, domain, referer) at `console.warn` level so we can spot any future "no tenant" case immediately in edge logs.

### 4. Cache-bust the storefront fallback path

When `widget-bootstrap` returns `tenant_id: null`, return `Cache-Control: no-store` (not `max-age=30`) so a fixed deploy is picked up on the next page load instead of being pinned by the CDN for half a minute per visitor.

### 5. Verification matrix (must all pass before declaring done)

Call `widget-bootstrap` for each row and confirm it returns the right `tenant_id` and the tenant's saved `widget_outer_color`:

| platform   | external_id          | domain                    | expected |
|------------|----------------------|---------------------------|----------|
| salla      | 1163458970           | (none)                    | this tenant |
| zid        | 1163458970           | demostore.salla.sa        | this tenant (cross-platform fallback) |
| (missing)  | 1163458970           | demostore.salla.sa        | this tenant (domain fallback) |
| salla      | 999999999 (bogus)    | demostore.salla.sa        | this tenant (domain fallback) |
| salla      | <other live merchant>| <other live domain>       | the other tenant (no cross-tenant leakage) |
| zid        | <live zid store_id>  | (none)                    | the zid tenant |

Then Playwright-load `https://demostore.salla.sa/dev-q6avnxiucdrzatze` and confirm:
- `widget-bootstrap` response includes `tenant_id = d49382a6-...` and `widget_outer_color = #dbe3f5`.
- Bubble paints in `#dbe3f5`, not black.

### 6. Out of scope (separate ticket, will not be touched here)

- Replacing the legacy `widget.fuqah.net/widget.js` deployment with the Supabase loader URL (Hostinger-side change, not in this repo).
- The Salla storefront "عذراً، حدث خطأ مؤقت" chat error — investigate after step 5 confirms the tenant is now resolving end-to-end.

### Multi-tenant safety guarantees

- Resolution is keyed on `(platform, external_id)` first and only falls back to `domain` when those miss — a domain match still goes through `salla_connections`/`zid_connections`/`settings_workspace` lookups, never a heuristic.
- No localStorage, no per-browser caching of tenant identity on the server. Each storefront page load re-resolves.
- Verification matrix explicitly covers the "wrong platform, different tenant" case to prove no cross-tenant leakage.