## Goal

Get the widget on Hostinger (`widget.fuqah.net`) talking to Supabase, which proxies to n8n, with proper tenant identification from Salla/Zid `store.id` and a simple rate-limit counter.

## Decisions locked in

- **Hosting**: Hostinger VPS (static files for `widget.js` + assets). No CDN setup needed from our side.
- **n8n integration**: **Option B** — browser → Supabase edge function (`chat-ai`) → n8n. Hides the n8n URL, lets us rate-limit, and lets n8n call back to enrich with tenant context.
- **Tenant ID**: the widget will NOT use `tenant_id` directly anymore. It will send `platform` + `store.id` and let Supabase resolve to `tenant_id` server-side.
- **Rate limit**: simple Supabase counter table per tenant per minute.

## Changes

### 1. Tenant resolution from `store.id` (the real fix)

Currently `widget.js` and `widget-config` expect `tenant_id`. Salla and Zid both expose `store.id`, not our internal UUID. Fix:

- **`widget-loader/index.ts`**: keep auto-detecting `platform` + `external_id` (already does), but **stop trying to expose `tenant_id` to the page**. Instead pass `platform` + `store_id` into the bundle via `window.__FUQAH_STORE_CTX = { platform, store_id }`.
- **`widget/src/app/config/supabase.ts`**: replace `getTenantId()` with `getStoreContext()` returning `{ platform, store_id }`. Read from `window.__FUQAH_STORE_CTX` first, then URL params (`?platform=salla&store_id=123`) for dashboard preview.
- **`widget-config` edge function**: accept `?platform=salla&store_id=123` (in addition to current `tenant_id` for dashboard preview), call existing `widget-resolve` logic internally, return config.
- **`widget-events`**: same — accept `platform`+`store_id` OR `tenant_id`, resolve server-side.
- All widget hooks (`useFetchChatSettings`, `useFetchStoreBranding`, `analytics.ts`) updated to send `platform`+`store_id` instead of `tenant_id`.

This means the storefront snippet stays one line with **zero config** — Salla/Zid already inject `store.id` automatically.

### 2. New `chat-ai` edge function (proxy to n8n)

`POST /functions/v1/chat-ai`

Body: `{ platform, store_id, conversation_id, message, history? }`

Flow:
1. Resolve `tenant_id` from `platform`+`store_id` (reuse `widget-resolve` logic in shared helper).
2. Check rate limit (see step 3). If exceeded → `429`.
3. Load merchant context from `settings_workspace` + `settings_train_ai` (store name, language, products link, AI persona).
4. POST to `N8N_WEBHOOK_URL` (new secret) with `{ tenant_id, store_context, message, history }`.
5. Return n8n's reply to the browser.
6. Insert message + reply into `conversations_messages` (real persistence, replaces event-only).

New secret needed: **`N8N_WEBHOOK_URL`** (will ask the user to add it).

### 3. Rate limit counter (simple)

New table `widget_rate_limits`:
```
tenant_id uuid, window_start timestamptz, count int, primary key (tenant_id, window_start)
```
- Window = 1 minute. Default cap = 30 messages/min/tenant (configurable later).
- `chat-ai` does an upsert+increment; if `count > 30` → 429.
- Cleanup: delete rows older than 1 hour via cron later (not blocking).

### 4. Dashboard "Install" tab

Add a new tab in `src/app/components/settings/Connections.tsx` (or new `WidgetInstall.tsx`) showing:
```html
<script src="https://widget.fuqah.net/widget.js" async></script>
```
Plus copy-to-clipboard button and short instructions for Salla/Zid app injection (already automatic via OAuth, this is mainly for manual/Shopify/custom sites).

### 5. Build & deploy widget to Hostinger

- Add `bun run build:widget` script in root `package.json` that runs `cd widget && vite build`.
- Output: `widget/dist/widget.js` (single IIFE file, already configured).
- User uploads `widget/dist/widget.js` + assets to Hostinger via SFTP/file manager. We'll provide one shell command they can run on the VPS to pull the latest build (optional follow-up).

## Files touched

- `supabase/functions/_shared/resolve-tenant.ts` — NEW shared helper
- `supabase/functions/widget-loader/index.ts` — set `__FUQAH_STORE_CTX`
- `supabase/functions/widget-config/index.ts` — accept platform+store_id
- `supabase/functions/widget-events/index.ts` — accept platform+store_id
- `supabase/functions/chat-ai/index.ts` — NEW proxy to n8n
- `supabase/config.toml` — register `chat-ai` with `verify_jwt = false`
- `widget/src/app/config/supabase.ts` — `getStoreContext()`
- `widget/src/app/hooks/useFetchChatSettings.ts` — use store context
- `widget/src/app/hooks/useFetchStoreBranding.ts` — use store context
- `widget/src/app/utils/analytics.ts` — use store context
- `widget/src/app/utils/chatApi.ts` — NEW, calls `chat-ai`
- `widget/src/app/components/ChatWidget.tsx` — wire AI replies through `chatApi`
- `src/app/components/settings/WidgetInstall.tsx` — NEW install tab
- DB migration: `widget_rate_limits` table

## Secrets required

- `N8N_WEBHOOK_URL` (will ask after plan approval)

## What I will NOT touch

- `widget-resolve` (already correct, will be reused internally)
- OAuth flows (already working per your message)
- Auth / RLS for dashboard (already correct)

## Open clarification (point 3 in your message)

You said "need more identification" for conversation persistence — does that mean:
- (a) you want anonymous visitors tracked by a cookie/localStorage `visitor_id`, OR
- (b) you want to require email/phone before the chat starts, OR
- (c) something else?

Default if you don't answer: **(a)** — generate a `visitor_id` in localStorage, pass it with every message. Easy, no UX friction, dashboard can group by visitor.
