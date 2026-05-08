## Goal

Patch your existing Hostinger `widget.js` (v3.0.0, 1789 lines, all v3 visuals intact) so it talks to the **current** Supabase backend (`kdrcgusinkqgwaafcgnw`) using the new `platform` + `store.id` model. Output: one drop-in file you upload to `public_html/widget.js`. **No CSS, HTML, or other Hostinger files needed.**

## What stays exactly the same

- All UI / DOM / CSS / SVG / fonts / animations from v3.0.0
- `window.FuqahChat` public API (`open/close/toggle/getMessages/getStoreId`)
- Boot sequence (`init()` → `loadCSS()` → `buildWidget()` → bottom-bar scan)
- Inline ticket form, rating screen, conversation download, attachment handling
- All Arabic copy

## What changes (5 surgical edits)

### Edit 1 — Supabase project + auth (lines 32–34)

```text
- SUPABASE_PROJECT = 'kyohutbusszojssbgbvw'
- SUPABASE_ANON_KEY = 'eyJhbGc…TgYntJK3VQeH3CpB1GGX1OYPOp_l91Kk6DmlyttghUo'
- API_BASE = 'https://…supabase.co/functions/v1/make-server-9f71bdbf'
+ SUPABASE_PROJECT = 'kdrcgusinkqgwaafcgnw'
+ SUPABASE_ANON_KEY = 'eyJhbGc…90d40LUVe1yqZMtHlDCq6RDlSLYpyrdrTb-On4zsfg0'
+ API_BASE = 'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1'
```

### Edit 2 — Tenant identification (right after line 22)

The script tag stays backward-compatible (`data-store-id` keeps working), and we add `data-platform` + auto-detection so it matches `widget-loader`:

```js
var PLATFORM   = scriptTag.getAttribute('data-platform')  || detectPlatform();
var STORE_ID   = scriptTag.getAttribute('data-store-id')  || detectStoreId();
var TENANT_ID  = scriptTag.getAttribute('data-tenant-id') || null; // dashboard preview
```

`detectPlatform()` / `detectStoreId()` mirror `widget-loader/index.ts`:
- Salla: `window.salla.config.get("store.id")` or `window.Salla.config.store.id`
- Zid: `window.zid.store_uuid` or `<meta name="zid-store-id">`
- Fallback: read `?platform=&store_id=&tenant_id=` from `window.location.search` (dashboard preview iframe path).

### Edit 3 — Replace `fetchSettings` + `fetchBranding` with one `fetchConfig` (lines 1675–1719)

The new `widget-config` endpoint returns design **and** branding in one response, so we collapse two fetches into one:

```js
function fetchConfig(callback) {
  var qs = TENANT_ID
    ? 'tenant_id=' + encodeURIComponent(TENANT_ID)
    : 'platform=' + encodeURIComponent(PLATFORM) + '&store_id=' + encodeURIComponent(STORE_ID);
  fetch(API_BASE + '/widget-config?' + qs, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && !d.error) {
        if (d.primary_color)        settings.mainColor        = d.primary_color;
        if (d.widget_outer_color)   settings.widgetOuterColor = d.widget_outer_color;
        if (d.widget_inner_color)   settings.widgetInnerColor = d.widget_inner_color;
        if (d.position === 'left')  settings.position         = 'bottom-left';
        if (d.workspace_name)       settings.storeName        = d.workspace_name;
        if (d.logo_url)             settings.storeLogo        = d.logo_url;
        if (d.icon_url)             settings.storeIcon        = d.icon_url;
        TENANT_ID = d.tenant_id || TENANT_ID;
      }
      callback();
    })
    .catch(function () { callback(); });
}
```

`init()` now calls `fetchConfig(onLoaded)` once instead of two parallel fetches (the `loaded >= 2` gate becomes `loaded >= 1`).

### Edit 4 — Real AI replies via `chat-ai` (lines 1069–1083)

Replace the `setTimeout(…canned text…)` block with a `fetch` to `/chat-ai`. The "type A to test ticket form" easter egg at line 1047 stays untouched.

```js
state.isTyping = true; renderMessages(); setInputDisabled(true);
var history = state.messages.slice(-10).map(function (m) {
  return { sender: m.sender, text: m.text };
});
fetch(API_BASE + '/chat-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
             Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
  body: JSON.stringify({
    platform: PLATFORM, store_id: STORE_ID, tenant_id: TENANT_ID,
    conversation_id: state.conversationId,
    visitor_id: getOrCreateVisitorId(),
    message: text, history: history
  })
})
  .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
  .then(function (res) {
    state.isTyping = false; setInputDisabled(false);
    var reply;
    if (res.status === 429)      reply = 'لقد تجاوزت الحد المسموح من الرسائل. الرجاء الانتظار دقيقة قبل المحاولة مجدداً.';
    else if (!res.ok || !res.d.reply) reply = 'عذراً، حدث خطأ مؤقت. الرجاء المحاولة مجدداً.';
    else                         reply = res.d.reply;
    state.messages.push({ id: '' + (Date.now() + 1), text: reply, sender: 'store', timestamp: new Date() });
    renderMessages();
  })
  .catch(function () {
    state.isTyping = false; setInputDisabled(false);
    state.messages.push({ id: '' + (Date.now() + 1), text: 'عذراً، حدث خطأ مؤقت. الرجاء المحاولة مجدداً.', sender: 'store', timestamp: new Date() });
    renderMessages();
  });
```

`getOrCreateVisitorId()` = small helper that reads/writes `localStorage.fuqah_vid` (uuid-ish).

### Edit 5 — Analytics events to `widget-events`

Add `postEvent(name)` helper and fire 3 events:
- `bubble.shown` — once after `buildWidget()` succeeds
- `bubble.click` — inside the bubble click handler
- `chat.message_sent` — inside `doSend()` when text is non-empty

```js
function postEvent(name) {
  try {
    fetch(API_BASE + '/widget-events', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
                 Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ event: name, platform: PLATFORM, store_id: STORE_ID, tenant_id: TENANT_ID })
    });
  } catch (e) {}
}
```

## Deliverables (written when you accept this plan)

1. **`/mnt/documents/widget.js`** — the full patched file (~1820 lines), ready to drag into Hostinger File Manager → `public_html/`. Will appear as a `<lov-artifact>` for one-click download.
2. **`/mnt/documents/widget.changelog.md`** — exact before/after for each of the 5 edits + verification snippets (curl commands + DevTools console one-liner).

## Files NOT touched

- Anything under `widget/src/**` (separate React bundle, not your Hostinger file)
- Any Supabase function (`widget-loader`, `widget-config`, `widget-resolve`, `widget-events`, `chat-ai` are already correct on the server)
- Dashboard code under `src/**`
- Any HTML/CSS — you upload **only** `widget.js` to Hostinger

## Verification after upload

```bash
curl -I https://widget.fuqah.net/widget.js
# expect: 200, content-type: application/javascript
```

In a Salla/Zid sandbox storefront:
```js
// DevTools console
window.__FUQAH_WIDGET_LOADED__   // true
window.__FUQAH_WIDGET_CONFIG__   // { storeId, mainColor, mode, position, storeName }
```

Send a message → should hit `chat-ai` (Network tab) → reply renders. Until n8n is wired, replies will return `n8n_not_configured` and the widget shows the friendly fallback string. We can flip on the `STUB_AI_REPLIES` env flag on `chat-ai` if you want canned `[stub]` replies for end-to-end UI testing before n8n.
