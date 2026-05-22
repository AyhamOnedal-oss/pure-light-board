# n8n workflow v2 — credential-driven Zid tools (final)

Rewrite to `fuqah-zid-workflow-v2.json`. AI never sees IDs/tokens/pagination — Supabase provides them, each tool node hard-wires them.

## Flow

```text
Webhook (POST /fuqah-chat)
   → Supabase: Get zid_connections row by tenant_id (n8n-nodes-base.supabase)
   → IF: is_active === true AND connection_status === 'connected'
        ├── false → Respond: { reply: "المتجر غير متصل حالياً", attachments: [] }
        └── true  → Set "Store Context"
                     → AI Agent (Tools Agent, gpt-4o-mini, JSON envelope)
                          ├── Window Memory (key = tenant_id + conversation_id)
                          ├── 12 Zid HTTP tools (creds + pagination pre-filled)
                     → Respond to Webhook { reply, attachments[] }
```

## Store Context (Set node) — values

Pulled from the Supabase row:
- `store_id` ← `{{ $json.store_id }}`
- `store_uuid` ← `{{ $json.store_uuid }}`
- `authorization_token` ← raw JWT (used as `Authorization: Bearer …`)
- `manager_token` ← encrypted token (used as `Access-Token: …`)
- `currency` = `SAR`, `locale` = `ar`

Plus from `$('Webhook').item.json.body`: `tenant_id`, `conversation_id`, `message`, `history`, `store.*`, `ai.prompt`.

## Tool catalogue (all GET, credentials + page=1/page_size=20 pre-baked)

| Tool | Endpoint | Model-exposed params |
|---|---|---|
| get_store_info | `/v1/managers/store` | — |
| search_products | `/v1/products` | `q?`, `category_id?`, `price_min?`, `price_max?` |
| get_product | `/v1/products/{id}` | `id` |
| get_product_by_sku | `/v1/products/by-sku/{sku}` | `sku` |
| list_categories | `/v1/categories` | — |
| search_orders | `/v1/orders` | `phone?`, `email?`, `order_number?` |
| get_order | `/v1/orders/{id}` | `id` |
| find_customer_by_phone | `/v1/customers/search/phone` | `phone` |
| list_abandoned_carts | `/v1/abandoned-carts` | `cart_id?` |
| list_coupons | `/v1/coupons` | — |
| list_shipping_countries | `/v1/countries` | — |
| list_shipping_cities | `/v1/countries/{country_id}/cities` | `country_id` |

Every node sends these headers, hard-coded from Store Context:
- `Authorization: Bearer {{ $('Store Context').item.json.authorization_token }}`
- `Access-Token: {{ $('Store Context').item.json.manager_token }}`
- `Store-Id: {{ $('Store Context').item.json.store_id }}`
- `Accept-Language: ar`
- `Accept: application/json`

## AI Agent

- Type: Tools Agent (`@n8n/n8n-nodes-langchain.agent` v1.7) — already correct per prior turn.
- Model: gpt-4o-mini with `responseFormat: json_object`.
- System prompt: keep v1 envelope (`{ reply, attachments: [product_card] }`, max 3 cards, always Arabic, no prose outside JSON). Adds merchant prompt from `ai.prompt` and store name/domain.
- Memory: Window Memory with `sessionKey = {tenant_id}-{conversation_id}`, contextWindowLength 10. History from `body.history` is replayed into memory at run start via a small Code node before the agent.

## Files

- `/mnt/documents/fuqah-zid-workflow-v2.json`
- `docs/n8n/fuqah-zid-workflow-v2.json`
- `docs/n8n/README.md` — append v2 section (Supabase credential setup, import steps, IF-guard explanation)

## Out of scope

- Widget changes (4.7.6 already renders `attachments`).
- Edge function changes.
- Multi-page pagination, write tools, token refresh logic.
