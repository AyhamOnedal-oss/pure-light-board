
# Salla/Zid OAuth + Widget Delivery Plan

Brings Salla/Zid OAuth into THIS project (Supabase ref `kdrcgusinkqgwaafcgnw`) and ships a real-time, isolated chat widget that auto-injects into Salla/Zid storefronts. Built on TanStack Start server routes (this project's stack — not Supabase Edge Functions).

---

## Phase 1 — Database foundation

### `salla_connections` (new)
- `id uuid pk`
- `tenant_id uuid` → `settings_workspace.id` (nullable; backfilled by claim)
- `merchant_id bigint` (Salla's merchant id — primary external key)
- `store_id text`, `store_name text`, `store_url text`, `store_email text`
- `access_token text`, `refresh_token text`
- `token_expires_at timestamptz`
- `is_active boolean default true`
- `connection_status text default 'pending_oauth'` (`pending_oauth` | `connected` | `disconnected`)
- `metadata jsonb default '{}'` (plan, scope, subscription)
- `connected_at`, `created_at`, `updated_at`
- Unique index on `merchant_id`
- RLS: tenant members SELECT; super_admin + service-role write

### `zid_connections` (new)
- `id uuid pk`
- `tenant_id uuid` → `settings_workspace.id` (nullable; backfilled by claim)
- `store_uuid text` (Zid's primary external key)
- `store_name text`, `store_url text`, `store_email text`
- `authorization_token text` (used as `Authorization: OAuth <token>`)
- `manager_token text` (used as `X-Manager-Token`)
- `refresh_token text`
- `token_expires_at timestamptz`
- `is_active boolean default true`
- `connection_status text default 'pending_oauth'`
- `metadata jsonb default '{}'`
- `connected_at`, `created_at`, `updated_at`
- Unique index on `store_uuid`
- RLS: same as Salla

### `salla_events` + `zid_events` (audit logs)
- `id, merchant_id/store_uuid, tenant_id, event_type, event_data jsonb, created_at`
- Admin-only SELECT, service-role INSERT

### `pending_salla_connections` (Easy Mode claim helper)
- `id, user_id, tenant_id, status, created_at, completed_at`
- RLS: user owns rows. Used because Salla `app.store.authorize` carries no `state`.

### Extend `settings_workspace`
- `salla_merchant_id bigint` and `zid_store_uuid text` — denormalized for fast widget lookup. Source of truth remains in `salla_connections`/`zid_connections`.

### Extend `settings_chat_design`
Add fields the widget needs that don't exist yet (per `fuqah-ai-dashboard.md` spec):
- `theme_mode text default 'light'`
- `bubble_offset_x int default 20`, `bubble_offset_y int default 20`, `bubble_size int default 60`
- `welcome_message text`, `input_placeholder text`, `auto_open_delay int default 0`
- `show_branding boolean default true`
- Feature toggles: `tickets_enabled`, `ratings_enabled`, `export_enabled`, `copy_enabled`, `message_feedback_enabled`, `media_enabled` (booleans)
- `allowed_countries text[] default '{}'`

---

## Phase 2 — OAuth (TanStack server routes under `/api/public/`)

All OAuth + webhook handlers use `supabaseAdmin` from `@/integrations/supabase/client.server` and verify signatures.

### Salla (Easy Mode — webhook-driven)

**`POST /api/public/oauth/salla/webhook`**
- Verify `X-Salla-Signature` HMAC against `SALLA_WEBHOOK_SECRET` (improvement over fuqah)
- Insert into `salla_events`
- Switch on `event`:
  - `app.store.authorize`: read tokens from payload, call `https://api.salla.dev/admin/v2/store/info` with bearer token → upsert `salla_connections` on `merchant_id` → match `pending_salla_connections` by email/user → backfill `tenant_id` + `settings_workspace.salla_merchant_id`
  - `app.uninstalled`: `is_active=false, connection_status='disconnected'`
  - `app.subscription.*`: update `metadata`

**`GET /api/public/oauth/salla/install`** — fallback redirect to dashboard

### Zid (Authorization Code)

**`GET /api/public/oauth/zid/callback`** — receives `?code&state` from Zid
- Exchange code at `https://oauth.zid.sa/oauth/token` (`grant_type=authorization_code`)
- Normalize tokens defensively (Zid returns inconsistent casing): `authorization_token`, `manager_token`, `refresh_token`
- Resolve `store_uuid` from `/v1/managers/account/profile` or recent `zid_events`
- Validate `state` as `tenant_id` via `auth_tenant_members` lookup; if invalid, store with `tenant_id=null` for later claim
- Upsert `zid_connections` on `store_uuid`
- Redirect to `/dashboard/settings/store?connected=zid` or `/login?from=zid&store_uuid=X`

**`POST /api/public/oauth/zid/webhook`**
- Verify Zid webhook signature
- Same lifecycle handling as Salla

**`POST /api/public/oauth/zid/refresh`** — internal cron endpoint
- Refresh tokens where `token_expires_at < now() + 60d`
- Wired via `pg_cron` daily

### Connections UI

New `Connections.tsx` page under `/dashboard/settings/connections`:
- Per-platform card: status badge, store name, last sync, disconnect button
- "Connect Salla" → external link to Salla App Store
- "Connect Zid" → builds Zid authorize URL with `state=<tenant_id>` and redirects to `https://oauth.zid.sa/oauth/authorize`

### Secrets to add (will prompt user before use)
- `SALLA_CLIENT_ID`, `SALLA_CLIENT_SECRET`, `SALLA_WEBHOOK_SECRET`
- `ZID_CLIENT_ID`, `ZID_CLIENT_SECRET`, `ZID_WEBHOOK_SECRET`

---

## Phase 3 — Widget delivery

All endpoints under `/api/public/widget/v1/`. Widget assets are public, read-only, cached.

### `GET /loader.js`
Returns the bootstrapper JS:
1. Detects platform context: `window.Salla?.config?.store?.id` or Zid (`<meta name="zid-store-id">` / `window.zid?.store_uuid`)
2. Calls `/resolve?platform=X&external_id=Y` → `{ tenant_id }`
3. Calls `/config?tenant_id=Z` → design + features JSON
4. Mounts launcher bubble in **Shadow DOM** (CSS isolation)
5. On click, mounts chat panel in an **iframe** pointing to `/widget/chat?tenant_id=Z`
- `Cache-Control: public, max-age=300, stale-while-revalidate=86400`

### `GET /resolve?platform=salla&external_id=12345`
- Looks up `salla_connections.merchant_id` or `zid_connections.store_uuid` → returns `tenant_id` and `is_active`
- 60s cache

### `GET /config?tenant_id=X`
- Returns `settings_chat_design` row + workspace branding (logo, name) — no PII
- 60s cache + stale-while-revalidate

### `POST /events/bubble-shown` and `POST /events/bubble-click`
- Increment counters in `dashboard_usage_daily`

### Standalone chat iframe route
- New TanStack route `src/routes/widget.chat.tsx` renders the full chat UI in isolation
- Calls existing conversation/ticket/attachment endpoints documented in `widget-integration-prompt.md`

### Storefront snippet (auto-injected via Salla/Zid app snippets)

```html
<script src="https://pure-light-board.lovable.app/api/public/widget/v1/loader.js" async></script>
```

No `data-tenant-id` — same snippet for every merchant; tenant resolves from platform context at runtime. Critical for the App Snippet auto-injection model (merchants don't paste anything manually).

### Style isolation strategy

| Surface | Isolation | Why |
|---|---|---|
| Launcher bubble | Shadow DOM root | Storefront CSS can't reach inside; bubble colors stay correct |
| Chat panel | `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">` | Full JS + CSS isolation; storefront can't break the chat |

### Real-time customization

The widget iframe subscribes to **Supabase Realtime** on `settings_chat_design` for its `tenant_id`. When the merchant changes a color or toggle in the dashboard, the storefront widget updates instantly without needing a page reload.

CSS variable mapping (per spec):
- `widget_outer_color` → `--fuqah-bubble-outer` on Shadow root
- `widget_inner_color` → `--fuqah-bubble-inner`
- `primary_color` → `--fuqah-primary` inside iframe
- `theme_mode` → `data-theme="dark|light"` on iframe `<html>`
- `inactivity_*` → JS timers in iframe
- Static colors (chat bg, user bubble bg) hard-coded in iframe CSS, not configurable

### Embed code panel
Add a section to `ChatCustomization.tsx` showing the snippet with a copy button.

---

## Improvements over fuqah's implementation

1. **Webhook signatures verified from day 1** (fuqah skips this — security gap)
2. **Tenant = workspace** (not user) — supports team membership properly via existing `auth_tenant_members`
3. **`onConflict` matches the actual unique key** — fuqah has a mismatch we won't repeat
4. **Single project for OAuth + widget + dashboard** — no cross-project sync
5. **Token refresh for both platforms** — fuqah only refreshes Zid

---

## File map (new + edited)

```
src/routes/api/public/oauth/salla/webhook.ts        (new)
src/routes/api/public/oauth/salla/install.ts        (new)
src/routes/api/public/oauth/zid/callback.ts         (new)
src/routes/api/public/oauth/zid/webhook.ts          (new)
src/routes/api/public/oauth/zid/refresh.ts          (new — cron-callable)
src/routes/api/public/widget/v1/loader.ts           (new — returns JS)
src/routes/api/public/widget/v1/resolve.ts          (new)
src/routes/api/public/widget/v1/config.ts           (new)
src/routes/api/public/widget/v1/events/bubble-shown.ts (new)
src/routes/api/public/widget/v1/events/bubble-click.ts (new)
src/routes/widget.chat.tsx                          (new — iframe target)
src/app/components/settings/Connections.tsx         (new dashboard page)
src/app/components/settings/ChatCustomization.tsx   (edit — add embed snippet + expanded controls)
src/app/services/sallaConnections.ts                (new client helper)
src/app/services/zidConnections.ts                  (new client helper)
src/server/oauth.server.ts                          (new server-only helpers)
src/server/widgetConfig.server.ts                   (new)
supabase/migrations/<ts>_oauth_and_widget.sql       (all schema + RLS)
```

---

## Suggested rollout

1. **Phase 1**: Migration (DB foundation, RLS, extended `settings_chat_design`)
2. **Phase 2a**: Salla OAuth + Connections UI (end-to-end installable)
3. **Phase 2b**: Zid OAuth + refresh cron
4. **Phase 3**: Widget loader, resolve, config, iframe chat route
5. **Phase 4**: Realtime sync + embed snippet panel + telemetry events

Recommend doing Phase 1 + 2a + Connections UI in the first build pass so you can install in Salla end-to-end, then Phase 2b, then Phase 3.
