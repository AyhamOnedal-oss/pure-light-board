# Widget v4.7.3 — `store.id` always populated

## Root cause

Zid Liquid `{{store.id}}` renders as the **UUID**. v4.7.2 puts the UUID into `STORE_ID` and posts it as `store_id`. The (already-fixed) `chat-ai` backend re-classifies that as `store_uuid`, leaving `store.id = null` in the n8n payload until OAuth backfills `zid_connections.store_id`. v4.7.3 makes the widget itself send `store_id` and `store_uuid` separately so n8n always has the correct UUID under `store.uuid` and can resolve a numeric id when present.

## Changes

### 1. `/mnt/documents/widget-4.7.3.js` (and overwrite `widget.js`)

Based on v4.7.2 with surgical edits:

- Header comment + console logs + `__FUQAH_WIDGET_CONFIG__.version` → `4.7.3`.
- New `isUuid(v)` helper at top scope.
- `detectStoreId(platform)` returns `{ store_id, store_uuid }`:
  - Read `data-store-id` and (new) `data-store-uuid` from the script tag.
  - If `data-store-id` matches UUID regex → assign to `store_uuid`, leave `store_id` null.
  - Skip unrendered `{{...}}` placeholders.
  - Salla branch unchanged (numeric).
  - Zid branch: prefer `window.zid.store_id` (numeric) + `window.zid.store_uuid`; meta tags `zid-store-id` / `store-uuid` classified by UUID test; new `meta[name="zid-merchant-id"]` accepted as numeric.
  - URL fallback reads both `store_id` and `store_uuid`.
- Add module-level `var STORE_UUID = ctx.store_uuid;` alongside `STORE_ID`.
- All outbound requests include both fields:
  - `restCreateTicket` → `widget-events` body
  - `bubble.click` `widget-events` body (line ~1902)
  - `chat-ai` body (line ~2213)
- `__FUQAH_WIDGET_CONFIG__` exposes `storeUuid` too.
- Boot log prints `store=<id|null> uuid=<uuid|null>`.

### 2. In-repo: `supabase/functions/widget-loader/index.ts`

Already correct (splits id/uuid, sends both to iframe URL, exposes `__FUQAH_STORE_CTX.store_uuid`). No change.

### 3. In-repo: `supabase/functions/chat-ai/index.ts`

Already correct (UUID-aware fallback, logs `resolved_id`/`resolved_uuid`, sends `store.uuid` to n8n). No change.

### 4. Artifacts

- `/mnt/documents/widget-4.7.3.js` (versioned copy for Hostinger)
- `/mnt/documents/widget.js` (overwritten with 4.7.3)
- `/mnt/documents/widget-v4.7.3-notes.md` (release notes — what changed, how to verify in n8n payload, no merchant action needed)
- Append entry to `/mnt/documents/widget.changelog.md`

## How to verify after deploy

1. Hard-refresh a Zid storefront with the snippet.
2. Console shows `Widget v4.7.3 ready ✓ store=<numeric|null> uuid=<uuid>`.
3. Send a chat message → n8n payload now contains `store.uuid: "<uuid>"`; `store.id` will be the numeric id if `zid_connections.store_id` is populated, otherwise still null until OAuth completes (this is by design).

## Confidence

Backend already accepts and forwards both fields, so this widget-only change is safe — no migration, no edge function redeploy required.
