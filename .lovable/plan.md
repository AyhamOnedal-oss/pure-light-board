## Problem

On storefronts the bubble takes 4–7s to appear. The loader currently does:

1. `GET /widget-resolve` (cold-start edge call) → returns `tenant_id`
2. `GET /widget-config?tenant_id=…` (second sequential edge call) → returns design

Two sequential edge-function round-trips, both `no-store`, on top of a Supabase cold start = several seconds on first visit. There is a localStorage instant-paint cache, but it only helps return visitors — first visit and any cache miss still waits for both calls. Dashboard setting changes also feel slow because the cached cfg stays painted until the SWR fetch completes and the visual-keys diff matches.

## Goal

- Bubble visible in < 300 ms on every visit (first visit included).
- Dashboard setting changes appear on the storefront within ~1s of reload, not 5–7s.

## Plan

### 1. One round-trip instead of two

Add a new edge function `widget-bootstrap` that takes `platform` + `external_id` and returns `{ tenant_id, is_active, cfg }` in a single call by doing the resolve + config join server-side (one query, one response). Update `widget-loader` to call only `widget-bootstrap`. This removes the sequential resolve→config waterfall (saves one full RTT + one cold start).

### 2. Paint bubble before any network

In `widget-loader`'s `boot()`:

- If localStorage cache exists → mount immediately (already done).
- If no cache → mount a "skeleton" bubble immediately using built-in defaults (black outer, white inner, bottom-right, size 60, no welcome). The user always sees a bubble in < 100 ms. When `widget-bootstrap` returns, diff visual keys and re-mount only if the real config differs from the skeleton. If `bubble_visible === false` arrives, remove the skeleton.

This makes first-visit perceived load identical to a repeat visit.

### 3. Make settings changes propagate fast

Two complementary changes:

- **Short edge cache with revalidation**: `widget-bootstrap` returns `Cache-Control: public, max-age=0, s-maxage=10, stale-while-revalidate=60` + a strong `ETag` derived from the cfg row's `updated_at`. The loader keeps `cache: "no-store"` so the browser always asks, but Supabase's edge/CDN can serve repeat requests in tens of ms.
- **Tighten the visual-keys diff & always re-mount on `updated_at` change**: include `updated_at` (or a hash) in the cached payload. If the fresh `updated_at` differs from cached, re-mount unconditionally — covers any field the visual-keys list forgets (e.g. welcome lines, offsets, bubble size). Today the diff list is hand-maintained and easy to miss.

### 4. Cut connection setup time

In `widget-loader`'s injected HTML head additions (done in JS at boot, before the fetch): inject `<link rel="preconnect" href="{SUPABASE_URL}" crossorigin>` and `<link rel="preconnect" href="{APP_BASE_URL}">`. Saves ~100–300 ms of TLS/DNS on first call and on the chat iframe load.

### 5. Lazy-load the chat iframe

Today the loader appends the chat `<iframe>` to the DOM at mount time even though it's `display:none`. That forces the iframe to fetch the React widget bundle on every page load, competing with the storefront for bandwidth. Change: only create/append the iframe on first bubble click. The bubble click already has a small loading affordance via its own UI. This dramatically reduces work during page load and makes the bubble paint feel even snappier.

## Technical notes

- New file: `supabase/functions/widget-bootstrap/index.ts` — joins `tenants` + `settings_chat_design` by `(platform, external_id)`, returns `{ tenant_id, is_active, cfg, updated_at }`. Reuses logic from existing `widget-resolve` and `widget-config`.
- Edit: `supabase/functions/widget-loader/index.ts`
  - Replace the resolve→config chain with one `widget-bootstrap` call.
  - Mount skeleton-with-defaults immediately on cache miss.
  - Include `updated_at` in cache; re-mount whenever it changes.
  - Inject preconnect link tags before the fetch.
  - Defer iframe creation until first bubble click.
- No dashboard or React-widget code changes required.
- Deploy `widget-bootstrap` and `widget-loader` after the edit.

## Out of scope

- Bundling the React widget into the loader to drop the iframe entirely (bigger refactor; revisit later if needed).
- Server-side rendering of the bubble HTML inside `widget-loader`'s response (would require per-tenant loader URLs and break the shared `widget.js` snippet model).
