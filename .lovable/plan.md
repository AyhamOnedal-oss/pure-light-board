# Fix Zid `store_id` end-to-end

## Root causes

**1. `zid_connections.store_id` is NULL** (Salla works because its callback writes `store_id`; Zid's doesn't).
`supabase/functions/zid-oauth-callback/index.ts` parses `store_uuid`, `store_name`, `store_url`, `store_email` from Zid's profile endpoints — but never reads the numeric `store.id`. The DB column exists, the OAuth code just doesn't populate it.

**2. n8n payload has no `store_id`.**
`supabase/functions/chat-ai/index.ts` (lines 130–168) only loads `settings_workspace` and forwards `store.name/locale/domain/platform`. It never queries `zid_connections` / `salla_connections`, so the numeric platform store id never reaches n8n.

## Changes

### A. `zid-oauth-callback/index.ts` — extract `store_id`
In the endpoint-walking loop, alongside `storeUuid` extraction add:
```ts
storeId =
  b?.user?.store?.id ??
  b?.data?.store?.id ??
  b?.store?.id ??
  b?.data?.id ??
  null;
if (storeId != null) storeId = String(storeId);
```
Include `store_id: storeId` in the `upsertRow` written to `zid_connections`.

### B. `chat-ai/index.ts` — include `store_id` in n8n payload
After resolving `tenant_id` / `platform`, fetch the platform connection row in parallel with the workspace/training queries:
- `platform === 'zid'`  → `select store_id, store_uuid from zid_connections where tenant_id = ? and is_active`
- `platform === 'salla'` → `select store_id, merchant_id from salla_connections where tenant_id = ? and is_active`

Extend the n8n body:
```ts
store: {
  id: conn?.store_id ?? null,          // numeric Zid/Salla store id
  uuid: conn?.store_uuid ?? null,      // Zid only
  merchant_id: conn?.merchant_id ?? null, // Salla only
  name, locale, domain, platform,
}
```

### C. Backfill the existing seed tenant (optional, one-shot)
Current row has `store_uuid = cb2b687a-…` but `store_id = NULL`. Two options:
- Leave it (only one test tenant; real merchants get it on next install).
- Or call `https://api.zid.sa/v1/managers/store/info` with the stored tokens once to fetch `store.id` and `UPDATE zid_connections SET store_id = '…'`.

Recommend leaving it — newly installed merchants will populate correctly after change A ships.

## Out of scope
- Widget snippet (already passes `data-store-id="{{store.id}}"` — that's the numeric id and `widget-resolve` already matches it via the `store_id.eq.<id>` OR-clause).
- n8n workflow itself — once `store.id` is in the payload, your n8n Zid HTTP nodes can read `{{ $json.store.id }}` directly.

## Verification
1. Reinstall Zid on a test store → check `zid_connections.store_id` is populated.
2. Send a widget message → inspect n8n incoming webhook payload → confirm `store.id` is present.
