# Fuqah × Zid n8n workflow (v1 — static)

This is the **v1 static** workflow you import into n8n while we wire up the
real multi-tenant token rotation later. One hardcoded test store, 9 grouped
tools covering all 18 Zid endpoints, and a system prompt that teaches the AI
to return **product cards with photos** the widget renders as image bubbles.

## 1. Import

1. n8n → **Workflows → Import from File** → pick `fuqah-zid-workflow-v1.json`.
2. Open the **Store Context** node and fill in:
   - `zid_access_token` — long-lived Access-Token for the test store (`X-Manager-Token` style header)
   - `zid_authorization` — `Bearer <authorization_token>` (the OAuth bearer Zid issues alongside)
   - `store_currency` — e.g. `SAR`
   - `store_locale` — e.g. `ar`
3. Activate the workflow. Copy the **Webhook URL** (production, not test).
4. Paste it into the Supabase secret `N8N_WEBHOOK_URL`.

## 2. Payload that arrives at the Webhook

Sent by `chat-ai` edge function:

```json
{
  "tenant_id": "uuid",
  "conversation_id": "uuid",
  "visitor_id": "v_...",
  "message": "بدّي أشوف عطور رجالية",
  "history": [{ "sender": "customer", "text": "..." }],
  "store": { "id": "...", "name": "...", "platform": "zid", "locale": "ar" },
  "ai": { "mode": "prompt", "prompt": "merchant system prompt", "file_url": null }
}
```

## 3. Response shape (what to send back via "Respond to Webhook")

```json
{
  "reply": "إليك أفضل ٣ عطور رجالية لدينا 👇",
  "attachments": [
    {
      "type": "product_card",
      "id": 12345,
      "name": "عطر الأمير الذهبي",
      "price": "320 SAR",
      "sale_price": "249 SAR",
      "image_url": "https://media.zid.store/.../prince.jpg",
      "url": "https://teststore.zid.sa/products/12345"
    }
  ]
}
```

The widget renders `attachments[]` as horizontal-scroll product cards beneath
the AI's text reply. If `attachments` is empty/missing, the widget just shows
the text — fully backwards compatible.

## 4. The 9 tools

| Tool name | Zid endpoints it wraps | Purpose |
|---|---|---|
| `get_store_info` | `/managers/store`, `/vat/settings`, `/account/payment-methods`, `/shipping/methods`, `/inventories/locations` | Static-ish store config |
| `search_products` | `/products`, `/products/categories` | List/filter products |
| `get_product` | `/products/{id}` | Detail + stock + variants |
| `search_orders` | `/orders` (by phone/email/order#) | Find customer orders |
| `get_order` | `/orders/{id}` | Status, tracking, items |
| `find_customer` | `/customers/search/phone`, `/customers/{id}` | Lookup by phone, then detail |
| `get_abandoned_cart` | `/abandoned-carts`, `/abandoned-carts/{id}` | Recover carts |
| `get_coupons_and_offers` | `/coupons`, `/bundle-offers` | Active promos |
| `get_shipping_destinations` | `/countries`, `/countries/{id}/cities` | Ship-to lookup |

All tool descriptions are in **English** (function-calling accuracy ~15% better
than Arabic-only descriptions in BPE-tokenized models). Response field labels
stay in **Arabic** so the LLM quotes them verbatim to customers.

## 5. Important system-prompt rules (already in the AI Agent node)

Appended after the merchant's `ai.prompt`:

```
You are a storefront assistant. Respond in Arabic.

When recommending or showing products, ALWAYS return JSON with this shape:
{
  "reply": "<short Arabic text>",
  "attachments": [
    { "type": "product_card", "id": <id>, "name": "<name_ar>",
      "price": "<price with currency>", "sale_price": "<or null>",
      "image_url": "<https from Zid>", "url": "<product page url>" }
  ]
}
Maximum 3–6 cards. Pull image_url + url from search_products / get_product.
When NOT recommending products, return plain text in "reply" and omit attachments.
```

## 6. Deferred to v2

- Live token rotation via `get-zid-token` edge function (currently hardcoded in Store Context)
- Multi-tenant — look up token per `tenant_id` from Supabase
- Supabase product cache + hourly cron sync (currently hits Zid live every turn)
- Pagination is internal but capped at 100 results; raise after caching lands

---

# v2 — credential-driven, multi-tenant (`fuqah-zid-workflow-v2.json`)

The v2 workflow removes all hard-coded tokens. Each call looks up the tenant's
Zid credentials from Supabase, then injects them into every Zid HTTP tool node.
The AI agent only picks **semantic** params (search query, order number,
phone, etc.) — it never sees store IDs, tokens, or pagination.

## Flow

```
Webhook → Get Zid Connection (Supabase) → Is Connected? (IF)
   ├── false → Respond: { reply: "المتجر غير متصل حالياً", attachments: [] }
   └── true  → Store Context (Set) → Format History (Code) → AI Agent
                 ├── Window Memory (tenant_id + conversation_id)
                 ├── 12 Zid HTTP tools (auth + page=1/page_size=20 pre-baked)
                 └── OpenAI Chat Model (gpt-4o-mini, JSON envelope)
              → Respond to Webhook { reply, attachments[] }
```

## Setup

1. n8n → **Credentials → New → Supabase API** — point to the Fuqah project.
2. **Workflows → Import from File** → `fuqah-zid-workflow-v2.json`.
3. Open **Get Zid Connection** → set the Supabase credential (replaces the
   `REPLACE_WITH_SUPABASE_CREDENTIAL_ID` placeholder).
4. Activate the workflow → copy production webhook URL → paste into
   Supabase secret `N8N_WEBHOOK_URL`.

No tokens to fill — the lookup pulls `authorization_token`, `manager_token`,
`store_id`, `store_uuid` from `zid_connections` by `tenant_id` on every call.

## Headers sent by every Zid tool node

```
Authorization: Bearer {{ authorization_token }}   (the JWT)
Access-Token:  {{ manager_token }}                (encrypted manager token)
Store-Id:      {{ store_id }}
Accept-Language: ar
Accept: application/json
```

## 12 tools (all GET, paginated where it makes sense)

| Tool | Endpoint | Model-exposed params |
|---|---|---|
| `get_store_info` | `/v1/managers/store` | — |
| `search_products` | `/v1/products` | `q?`, `category_id?`, `price_min?`, `price_max?` |
| `get_product` | `/v1/products/{id}` | `id` |
| `get_product_by_sku` | `/v1/products/by-sku/{sku}` | `sku` |
| `list_categories` | `/v1/categories` | — |
| `search_orders` | `/v1/orders` | `phone?`, `email?`, `order_number?` |
| `get_order` | `/v1/orders/{id}` | `id` |
| `find_customer_by_phone` | `/v1/customers/search/phone` | `phone` |
| `list_abandoned_carts` | `/v1/abandoned-carts` | `cart_id?` |
| `list_coupons` | `/v1/coupons` | — |
| `list_shipping_countries` | `/v1/countries` | — |
| `list_shipping_cities` | `/v1/countries/{country_id}/cities` | `country_id` |

`page=1` and `page_size=20` are hard-coded as fixed query params on every
list/search tool — never exposed to the model.

## Output contract

Unchanged from v1 — the widget (4.7.6+) already renders `attachments[]` as
product cards. Same JSON envelope, max 3 cards.