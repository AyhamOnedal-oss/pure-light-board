# Speed up the Hostinger `widget.js` (v4.7.33)

The earlier work optimized the storefront-loader edge function (`widget-loader`), but Hostinger merchants embed a different script: `public/widget-4.7.32-hostinger.js` (served from `https://widget.fuqah.net/widget.js`). That script still does a sequential `widget-resolve` → `widget-config` round-trip with no cache, which is why the bubble takes 4–7s to appear on cold start.

## Goal

- Bubble visible in <200ms on repeat visits, ~1 round-trip on first visit.
- Dashboard setting changes apply within seconds (keep existing 20s poll + tab-focus refresh).
- No regressions in events, inactivity, rating, or chat flow.

## Changes to `public/widget-4.7.32-hostinger.js` → save as `public/widget-4.7.33-hostinger.js`

1. **Bump banner to v4.7.33** with a short note: "instant paint via localStorage cache + single-round-trip `widget-bootstrap`".
2. **Preconnect**: on script start, inject `<link rel="preconnect" crossorigin>` and `<link rel="dns-prefetch">` for `SUPABASE_URL` so the first fetch reuses a warm TLS connection.
3. **Cache key**: `fuqah_widget_cache_<platform>_<external_id>` storing `{ tenant_id, cfg, updated_at, ts }`.
4. **Instant paint path** (inside `boot()` before `fetchConfig`):
   - Read cache; if present, set `TENANT_ID`, call `applyConfigPayload(cached.cfg)`, then `buildWidget()` immediately.
   - If no cache, render a default skeleton bubble (black outer / white inner, right side, size 60) so the user always sees a launcher within ~100ms. Track `mountedSkeleton = true`.
5. **Replace `fetchConfig` round-trip**: swap the `widget-resolve` + `widget-config` chain for a single call to `widget-bootstrap?platform=…&external_id=…` (already deployed). Pass `If-None-Match` from cached ETag (`"<tenant>:<updated_at>"`) so we get a 304 when nothing changed.
6. **On response**:
   - If `!tenant_id || !is_active || !cfg`: if a skeleton was mounted, remove it via `cleanupWidgetDom()`.
   - Else: write fresh cache; only call `buildWidget()` again when `mountedSkeleton`, tenant changed, or `updated_at` moved (covers every visual field — drop the manual diff list eventually, but keep `applyConfigPayload` change-detection as a fallback).
7. **`refreshConfigLive`** (the 20s poll + focus refresh) keeps using `widget-config?tenant_id=…` — no change needed, it already re-renders only when visuals change and the window is closed.
8. **Backfill `STORE_ID`/`STORE_UUID`**: `widget-bootstrap` doesn't return these today. Either:
   - (a) extend `widget-bootstrap` to also return `store_id` / `store_uuid` from `resolveTenant`, OR
   - (b) keep `widget-resolve` as a one-shot fallback only when the snippet renders neither ID (rare).
   Prefer (a) — minor edit, no extra request.
9. Update any reference to `widget-4.7.32-hostinger.js` (docs, snippets) → `widget-4.7.33-hostinger.js` and keep v4.7.32 on disk as a fallback.

## Technical details

- File: `public/widget-4.7.33-hostinger.js` (new copy, edits per above).
- Edge function: `supabase/functions/widget-bootstrap/index.ts` — add `store_id` + `store_uuid` from `resolveTenant` to the JSON payload; redeploy.
- No changes to chat-ai, events, rating, ticketing, inactivity, or DOM building.
- Cache TTL: rely on `updated_at` ETag; no hard expiry. Optional safety: ignore cache older than 7 days.

## Out of scope

- Bundling the widget into the loader.
- Service-worker / HTTP/3 / CDN tuning.
- Changing the embed snippet's `<script>` URL pattern.

## Validation

- Hard-reload a Hostinger store with cache cleared → bubble appears immediately (skeleton), real config swaps in once `widget-bootstrap` returns.
- Reload again → bubble paints from cache in <200ms; network shows a single `widget-bootstrap` call returning 304.
- Change widget color in dashboard → within ≤20s (poll) or on tab focus, the bubble re-renders with the new color while closed.
