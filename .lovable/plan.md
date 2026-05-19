# Phase 3 (simple) — Zid AI Agent with plain HTTP Request tools

One Supabase call grabs the token, then the AI Agent hits Zid directly via HTTP Request tools. No sub-workflow, no rate-limit table, no error-log table.

## What stays from the previous plan
- `get_zid_credentials(p_tenant_id)` RPC — already migrated ✅
- `zid-token-refresh` edge function + daily cron — still required (tokens expire)

## What gets dropped
- Sub-workflow `fuqah-zid-call-subworkflow.json`
- `zid_rate_buckets` table + `check_zid_rate_limit` RPC
- `zid_api_errors` table
- `zid_token_refresh_errors` stays (cron needs somewhere to log failures)

Cleanup migration will `DROP TABLE zid_rate_buckets, zid_api_errors` and `DROP FUNCTION check_zid_rate_limit`. The `get_zid_credentials` RPC and `zid_token_refresh_errors` table remain.

## New n8n workflow shape

```text
Webhook
  → Get Zid Creds  (HTTP → Supabase RPC, 1 node)
  → AI Agent
      ├── OpenAI Chat Model
      └── Tools: 8 × HTTP Request (Zid API, direct)
  → Respond to Webhook
```

### Node 1 — Get Zid Creds (HTTP Request)
- Method: `POST`
- URL: `https://kdrcgusinkqgwaafcgnw.supabase.co/rest/v1/rpc/get_zid_credentials`
- Headers: `apikey: <ANON>`, `Authorization: Bearer <ANON>`, `Content-Type: application/json`
- Body: `{ "p_tenant_id": "{{ $json.tenant_id }}" }`
- Output (array, take `[0]`): `authorization_token`, `manager_token`, `token_expires_at`

### Node 2 — AI Agent
- System message: same Arabic merchant prompt, with `tenant_id` injected
- User message: `={{ $('Webhook').item.json.message }}`
- 8 HTTP Request tools attached (below)

### Shared headers on every Zid HTTP tool
```
Authorization: Bearer {{ $('Get Zid Creds').item.json[0].authorization_token }}
X-Manager-Token: {{ $('Get Zid Creds').item.json[0].manager_token }}
Accept-Language: ar
Accept: application/json
```

### The 8 tools (each = one HTTP Request tool node)
| Tool | Method | URL | AI fills |
|---|---|---|---|
| `lookup_order` | GET | `https://api.zid.sa/v1/managers/store/orders/{order_id}` | `order_id` |
| `list_recent_orders_by_phone` | GET | `https://api.zid.sa/v1/managers/store/orders?customer_mobile={phone}&per_page=5` | `phone` |
| `search_products` | GET | `https://api.zid.sa/v1/products?search={query}&per_page=10` | `query` |
| `get_product_details` | GET | `https://api.zid.sa/v1/products/{product_id}` | `product_id` |
| `list_categories` | GET | `https://api.zid.sa/v1/categories` | — |
| `get_store_policies` | GET | `https://api.zid.sa/v1/managers/store/settings` | — |
| `find_customer` | GET | `https://api.zid.sa/v1/managers/store/customers?search={phone_or_email}` | `phone_or_email` |
| `validate_coupon` | GET | `https://api.zid.sa/v1/managers/store/coupons/{code}` | `code` |

### Node 3 — Respond to Webhook
`{ "reply": "{{ $json.output }}" }`

## System prompt (prepend to merchant prompt)
```
أنت مساعد متجر {{store.name}}. عندك أدوات للوصول لبيانات الطلبات والمنتجات والسياسات.
قواعد:
1. لو العميل سأل عن طلب ولم يعطِ رقم → اطلب رقم الطلب أو رقم الجوال.
2. لو سأل عن منتج ولم يحدد → اسأله الاسم.
3. لا تخترع بيانات. لو الأداة رجعت خطأ، اعتذر واطلب التحقق.
4. ردودك مختصرة بالعربية، وتنتهي بـ "هل تحتاج شيء آخر؟".
```

## Deliverables on approval
1. Cleanup migration (drop the 3 unused objects).
2. Replace `/mnt/documents/fuqah-zid-n8n-workflow.json` with the simplified single-workflow JSON (1 creds node + AI Agent + 8 HTTP tools + Respond).
3. Delete `/mnt/documents/fuqah-zid-call-subworkflow.json`.
4. Keep `zid-token-refresh` edge function unchanged.

## Trade-offs you're accepting
- No app-side rate-limit guard (Zid returns 429 if you exceed ~30/min — fine for chat traffic).
- No DB error log; failures show in n8n's Executions tab only.
- Adding a new endpoint = duplicate one HTTP tool node.

Approve and I'll generate the new JSON + run the cleanup migration.
