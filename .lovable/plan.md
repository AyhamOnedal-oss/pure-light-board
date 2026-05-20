
# Always get a valid `store.id` for Zid

## What the Zid docs actually say

Two separate Zid doc pages, two different meanings of "store.id":

1. **Theme data (`themes.zid.dev/data-reference/store`)** — the Liquid/Jinja `{{ store.id }}` token rendered server-side in a theme renders to the **numeric** merchant id (e.g. `1011`). `{{ store.uuid }}` is the UUID. So the value IS numeric *when the template engine runs*.

2. **Storefront Events (`docs.zid.sa/doc-649611`)** — the only Zid globals reliably exposed to a Custom Snippet at page load are:
   - `window.customer`
   - `window.customerAuthState`
   - `window.customerAsync`

   `store.id` listed in the screenshot is a **parameter inside event payloads** (signup, purchase, etc.) — NOT a global object. So we cannot read `window.store.id` from a snippet at page load.

3. **Custom Snippets / App Scripts** (the section the merchant uses) are documented as plain JS/CSS injection. The doc does NOT promise Liquid/Twig templating runs on a snippet body, so `{{store.id}}` in your `<script data-store-id="{{store.id}}">` may or may not be rendered depending on where Zid pastes it.

Your current snippet:
```html
<script src="https://widget.fuqah.net/widget.js?v=19"
        data-platform="zid"
        data-store-id="{{store.id}}"></script>
```
If Zid does template it → arrives as `data-store-id="1011"` (good, numeric).
If Zid does NOT template it → arrives as `data-store-id="{{store.id}}"` (literal). v4.7.3 already skips that, but then nothing identifies the store.

## Plan

Three layers so identification never fails — independent of whether `{{store.id}}` renders.

### 1. Update the install snippet (one line)

```html
<script src="https://widget.fuqah.net/widget.js?v=20"
        charset="UTF-8"
        data-platform="zid"
        data-store-id="{{store.id}}"
        data-store-uuid="{{store.uuid}}"
        async></script>
```

`data-store-uuid` belt-and-suspenders. Update the install instructions in `src/app/docs/widget-integration-prompt.md` and any Zid-app onboarding copy.

### 2. Add domain-based tenant fallback (the reliable path)

If neither `store_id` nor `store_uuid` is usable, identify the merchant by their storefront domain (`window.location.hostname`, stripped to root). We already store this on `settings_workspace.domain`.

**Widget v4.7.4 (`/mnt/documents/widget-4.7.4.js`)**
- Continue v4.7.3 detection.
- If both `STORE_ID` and `STORE_UUID` end up null after all checks, send `domain=<hostname>` to `/widget-resolve`.
- Read `window.customer` (Zid storefront global) and attach `{ id, name, email, mobile }` to `chat-ai` payloads as `visitor` so n8n gets real customer identity when the shopper is logged in.

**`supabase/functions/widget-resolve/index.ts`** (in-repo edit)
- Accept new query `domain=`. Lookup order (unchanged for existing params):
  1. `platform + external_id` (current)
  2. `domain` → `select tenant_id from settings_workspace where lower(domain) = lower(:domain) and is_active`
- Return the same `{ tenant_id, is_active }` shape.

**`supabase/functions/chat-ai/index.ts`** (in-repo edit)
- Accept optional `domain` + `visitor` fields.
- `resolveTenant` already accepts `tenant_id`; extend `_shared/resolve-tenant.ts` with a `domain` branch that mirrors the lookup above.
- Pass `visitor` (Zid customer object) into the n8n payload under `customer: { id, name, email, mobile }`.

No DB migration required — `settings_workspace.domain` already exists and the existing zid_connections table is unchanged.

### 3. Verification

- Reload a Zid storefront with the new snippet → console: `Widget v4.7.4 ready ✓ storeId=1011 storeUuid=<uuid> domain=mystore.com`.
- Send a chat → n8n payload contains `store.id: 1011`, `store.uuid: "..."`, and `customer: {...}` when the shopper is signed in.
- Simulate the broken case: remove `data-store-*` from the snippet → widget falls back to `domain=mystore.com`, `widget-resolve` returns the same tenant, n8n still receives full `store` block populated from `zid_connections`.

## Artifacts to deliver

- `/mnt/documents/widget-4.7.4.js` and overwrite `/mnt/documents/widget.js`
- `/mnt/documents/widget-v4.7.4-notes.md` + append to `widget.changelog.md`
- In-repo edits to `widget-resolve`, `chat-ai`, `_shared/resolve-tenant.ts`, and the install docs

## Why this is bulletproof

- If Liquid renders → numeric `store.id` flows through (best path).
- If Liquid doesn't render → domain fallback identifies the tenant (works for every Zid store with a published domain).
- If the storefront global `window.customer` is present → n8n also gets the shopper identity per Zid's official storefront-events contract.

## Open question for you

Do you want me to **also** wire the storefront event hooks (`productCart`, `productViewd`, `Purchase`, `Start Checkout`) into widget-events so n8n can track shop activity (cart, viewed product, recent purchases) and the AI can use it for replies? That's a separate, larger piece of work — I can scope it as v4.8.0 in a follow-up plan if you want it.
