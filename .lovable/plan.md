# n8n Zid Workflow v1 (Static) + Product Image Cards

Goal: ship a working n8n workflow now using **hardcoded Zid token + store context** (one test store), with 9 grouped tools covering all 18 endpoints you listed. AI Agent can return **rich product cards with photos** that the widget renders as image bubbles. Token rotation, multi-tenant, and caching come later.

---

## Part 1 — n8n workflow structure

```text
Webhook (POST /fuqah-chat)
   │
   ▼
Set "Store Context"  ← hardcoded: zid_token, store_id, currency, locale
   │
   ▼
AI Agent (system message = $json.ai.prompt + product-card protocol)
   ├── Tool 1: get_store_info
   ├── Tool 2: search_products
   ├── Tool 3: get_product
   ├── Tool 4: search_orders
   ├── Tool 5: get_order
   ├── Tool 6: find_customer
   ├── Tool 7: get_abandoned_cart
   ├── Tool 8: get_coupons_and_offers
   └── Tool 9: get_shipping_destinations
   │
   ▼
Respond to Webhook  →  { reply, attachments[] }
```

Each tool is an **HTTP Request Tool** node with:
- URL: `https://api.zid.sa/v1/<endpoint>`
- Header: `Access-Token: {{ $('Store Context').item.json.zid_token }}`
- Header: `Authorization: Bearer {{ $('Store Context').item.json.manager_token }}`
- English description (better function-calling accuracy)
- Input schema declared so the LLM passes correct params
- Internal pagination (loop until `next === null`, cap 100 results)
- Response trimming via a Function node before returning to the agent

---

## Part 2 — Product image cards (the "push photos" feature)

The AI doesn't literally send images — it returns a **structured response** the widget renders as image bubbles. Two layers:

### 2a. AI output protocol

Add to the AI Agent system message:

```
When recommending products, ALWAYS respond with this JSON shape:
{
  "reply": "<short Arabic text>",
  "attachments": [
    {
      "type": "product_card",
      "id": "<zid product id>",
      "name": "<name_ar>",
      "price": "<formatted with currency>",
      "sale_price": "<or null>",
      "image_url": "<https from Zid>",
      "url": "<product page url>"
    }
  ]
}
Maximum 3 cards per reply. Pull image_url from search_products / get_product responses.
```

### 2b. Widget rendering

`widget/src/app/utils/chatApi.ts` already returns `{ reply }`. Extend it to also surface `attachments[]`, then render product cards as a new message variant alongside existing text/`AttachmentBubble` bubbles.

New component: `widget/src/app/components/ProductCardBubble.tsx`
- Image (square, rounded), name, price (with strike-through if sale), "View" button → opens `url` in new tab
- Stack of up to 3 cards under the AI text reply
- RTL-aware, themed via existing ThemeSettingsContext

`chat-ai` edge function: pass through `attachments` from n8n response unchanged.

---

## Part 3 — What I'll build in this loop

1. **n8n workflow JSON** (importable file at `docs/n8n/fuqah-zid-workflow-v1.json`) with all 9 tools wired, hardcoded token placeholders, English descriptions, response-trimming Function nodes, product-card system prompt.
2. **`docs/n8n/README.md`** — import steps, where to paste the test-store token, expected payload shape, how to test each tool.
3. **Widget changes**:
   - Extend `SendMessageResult` with `attachments?: ProductCard[]`
   - New `ProductCardBubble.tsx` component
   - Update `ChatMessage.tsx` to render product cards under AI replies
   - Theming via existing tokens (no custom colors)
4. **`chat-ai` edge function**: forward `attachments` field from n8n → widget.

Out of scope for v1 (deferred):
- Supabase product cache + cron sync
- `get-zid-token` edge function for live token rotation
- Multi-tenant resolution in n8n (currently 1 hardcoded store)

---

## Technical notes

- **Tool descriptions in English** — function-calling accuracy drops ~15% with Arabic-only descriptions in BPE-tokenized models. Field labels in responses stay Arabic so the LLM quotes them verbatim.
- **Pagination hidden from LLM** — each tool's sub-workflow loops `page=1..N` internally until `next` is null or 100 items collected. The LLM only sees the merged result.
- **Field trimming is mandatory** — raw Zid product = ~6KB; trimmed = ~400B. Without trimming, one `search_products` call burns ~30K tokens.
- **Product cards use Zid's CDN image URLs directly** — no proxying, no Supabase storage. Lazy-loaded in the widget.
- **Backwards compatible** — if n8n returns plain `{ reply }` with no `attachments`, widget behaves exactly as today.

Confirm and I'll build it.
