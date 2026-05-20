I found the actual drop point:

- `widget-loader` does read `data-store-id`, resolves the tenant, and passes it into the iframe URL as `store_id`.
- But `chat-ai` builds the n8n payload using only `zid_connections.store_id` for `store.id`.
- Your current DB row has `zid_connections.store_id = NULL` and `store_uuid = cb2b687a-...`, so n8n receives `store.id: null` even if the widget request included the rendered Zid `{{store.id}}`.

Plan:

1. Update `widget-loader` to make script attribute parsing more robust:
   - Prefer `document.currentScript`.
   - Then scan widget script tags from newest to oldest.
   - Keep separate `store_id` and `store_uuid` fields instead of collapsing everything into one `external_id`.
   - Pass both `store_id` and `store_uuid` into `/widget/chat` when available.

2. Update `chat-ai` so n8n receives the storefront-provided ID as a fallback:
   - For Zid, set `store.id` to `zid_connections.store_id` if present, otherwise use the incoming `store_id` when it is not a UUID.
   - Set `store.uuid` to `zid_connections.store_uuid` if present, otherwise use the incoming `store_id` when it is a UUID.
   - This fixes your exact case where the database row has only `store_uuid` but the widget request can carry the numeric `data-store-id`.

3. Keep database connection lookup as the preferred source:
   - If OAuth later populates `zid_connections.store_id`, that value remains authoritative.
   - If it is missing, the widget snippet value still reaches n8n.

4. Add temporary-safe logging in `chat-ai` only for non-secret identifiers if needed:
   - Log platform, tenant_id, incoming store_id, DB store_id, DB store_uuid.
   - This will make it easy to confirm in Edge Function logs that the rendered Zid snippet value arrived.

Expected n8n result after implementation:

```json
"store": {
  "id": "<rendered Zid numeric store id>",
  "uuid": "cb2b687a-7d88-4ecf-8027-806782ac5cbe",
  "merchant_id": null,
  "platform": "zid"
}
```