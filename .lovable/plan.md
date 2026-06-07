# Plan — Mock data + Zid widget + Email dates + Zid token refresh

## 1. Remove all mock data for new accounts

`seedDemoData` is opt-in via a button — fine. But `src/app/components/DashboardPage.tsx` ships hardcoded values that show on every brand-new account (matches your screenshot: `4.8 / 1,247 ratings` and `847 / 53` thumbs while every metric tile is 0):

- **Customer Rating tile** (lines 318–337): hardcoded `4.8`, hardcoded 5 stars, hardcoded "Based on 1,247 ratings".
- **AI Message Feedback section** (lines 528–~700): hardcoded counters `847 / 53` and a static list of 6 fabricated conversations (`fb1`…`fb6`).

### Fix
- **Customer Rating tile** → drive from `metrics.csat` (already returned by `dashboard_metrics`): average rounded to 1 decimal, stars filled by rounded value, sub-label = `${metrics.csat.total} ratings`. When `metrics.csat.total === 0`, render the same empty-state pattern used by the AI Feedback donut (icon + "No ratings yet / لا توجد تقييمات بعد").
- **AI Message Feedback section** → drive from real `conversations_messages.feedback`:
  - Counters use `metrics.feedback.positive / negative` (delete the literal `847` / `53`).
  - The 6 fabricated rows are pure decoration — remove the whole hardcoded array. Add `fetchRecentAiFeedback(tenantId, range, limit=20)` in `src/app/services/metrics.ts`, expose it via `useDashboardMetrics`, and render the list (with empty state) from real data.

After this, a brand-new tenant sees 0 / empty states everywhere — no fake numbers, no fake conversations.

## 2. Why the Zid widget isn't showing for `traex6cmd3@zam-partner.email`

Verified from the DB: install is correct — `zid_connections` row exists, `is_active=true`, `connection_status=connected`, `store_id=3162894`, `store_uuid=d14a17c5-…`, tenant `74787391-…`, `bubble_visible=true`, design row present. So `widget-resolve` and `widget-config` will both succeed.

Root cause: **nothing ever injects the loader `<script>` into the Zid storefront.** `widget-loader/index.ts` exists and is correct, but no edge function registers it via Zid's storefront script API after OAuth, and there is no "copy this snippet" UI in the dashboard. After OAuth completes, the storefront HTML still has zero reference to `widget.js`, so the bubble never appears even though auth, tenant resolution, and config are all healthy.

### Fix (two complementary pieces)

**A. Auto-register the loader via Zid's storefront script API in `zid-oauth-callback`**

After `provisionMerchantAccount` + the `zid_connections` upsert, register the loader script with the manager token. The snippet content:

```html
<script async src="${SUPABASE_URL}/functions/v1/widget-loader"
        data-platform="zid"
        data-store-id="{{store.id}}"
        data-store-uuid="{{store.uuid}}"></script>
```

- Save the returned script id on `zid_connections` (new nullable column `theme_script_id text`) so we can update/delete it later.
- Guard with try/catch — if the call fails (token scope, theme locked, custom Vitrin theme, etc.) log to `zid_events` and continue; install must not fail because of script injection.
- On the uninstall webhook, delete the script using the saved id.

**B. Manual fallback snippet in the dashboard**

Add a small "Install widget" panel (in `Settings → Store Info`, or a new tab) that shows the exact `<script …>` tag with this tenant's `store_id` / `store_uuid` pre-filled, plus a copy button and a one-line instruction in Arabic: "إذا لم تظهر الفقاعة تلقائياً، الصق هذا الكود في رأس قالب متجرك في زد". This guarantees recovery for any store where the API injection fails or where the merchant uses a custom theme.

### Caveats / things to know before testing

- Test stores need to actually load the **published** storefront URL — the widget does not render inside Zid's admin/preview iframe (Shadow DOM + fixed positioning get stripped by Zid's preview wrapper).
- Browser cache: after reinstalling, hard-refresh the storefront once (`Cmd-Shift-R`). `widget.js` is served `no-store`, but the Zid theme HTML is cached aggressively.
- The Zid webhook is currently rejecting calls with `invalid signature` (visible in edge logs). Not related to this bug, but it means uninstall/app-status events aren't being processed — worth fixing in the same pass.

## 3. Emails must always use English / Gregorian dates

You saw "محرم" in an email because we format with `Intl.DateTimeFormat("ar-SA", …)` — Zid's `ar-SA` locale defaults to the **Hijri** calendar in JS runtimes, so dates render as Islamic months.

Files using `ar-SA` for dates:
- `supabase/functions/send-password-reset/index.ts` (lines 163, 166)
- `supabase/functions/send-login-notification/index.ts` (lines 198, 201)
- `supabase/functions/_shared/provision-merchant.ts` (line 146)
- `supabase/functions/_shared/resend.ts` (lines 39, 46)

### Fix
Replace every `Intl.DateTimeFormat("ar-SA", …)` for **dates** with `Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Riyadh" })` so we get e.g. `07 Jun 2026` regardless of email language. For times use `Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" })`. (Numbers can keep Arabic-Indic if we want — the user asked specifically about dates.)

Keep email body Arabic; only the date/time tokens switch to English/Gregorian.

## 4. Align Zid token refresh with the official docs

Per Zid docs (https://docs.zid.sa/authorization §4):
- `expires_in` returned by `/oauth/token` is **1 year**.
- Both the access token (`X-Manager-Token`) and the refresh token expire in **1 year**.
- Recommended: refresh **before 10 months pass** (i.e., proactively, not at the last minute).
- The refresh call must POST to `https://oauth.zid.sa/oauth/token` with body fields: `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`, **`redirect_uri`**.

Current `supabase/functions/zid-token-refresh/index.ts` deviates in two ways:
1. **Selects rows where `token_expires_at < now + 30 days`** — only 30 days of buffer. If the cron misses a window, or a store had no activity for 11 months, the refresh token can expire before we touch it.
2. **Omits `redirect_uri`** in the refresh body (Zid's docs include it in the example).

### Fix
- Change selection to `token_expires_at < now + 60 days` **OR** `connection_status = 'refresh_failed'`. 60 days = comfortable buffer well inside Zid's 10-month recommendation, and still recovers any row we missed.
- Include `redirect_uri = ${SUPABASE_URL}/functions/v1/zid-oauth-callback` in the refresh body (exact value already used in `zid-oauth-callback`).
- Add a `last_refreshed_at timestamptz` column on `zid_connections` so we can audit refresh activity and so the cron can also force a refresh when `now - last_refreshed_at > 270 days` (≈ 9 months) as a belt-and-braces guard.
- Verify cron schedule: `zid-token-refresh` should run **daily** (current schedule should be confirmed; if it's only weekly/monthly, change to daily so the 60-day buffer is meaningful).
- Keep using `expires_in` from the response (don't hardcode 1 year) but keep `31536000` as the fallback default so we never store a NULL/short expiry.

## Technical summary

- `src/app/components/DashboardPage.tsx`: replace hardcoded `4.8 / 1247` and `847 / 53` + the `fb1…fb6` array with values from `useDashboardMetrics()` + a new `recentAiFeedback` query; add empty states.
- `src/app/services/metrics.ts` + `src/app/hooks/useDashboardMetrics.ts`: add `fetchRecentAiFeedback(tenantId, range)` returning `{ body, feedback, conversation_id, created_at }[]`.
- `supabase/migrations/<ts>_zid_connections_widget_install.sql`: add `theme_script_id text` and `last_refreshed_at timestamptz` to `public.zid_connections`.
- `supabase/functions/zid-oauth-callback/index.ts`: after upsert, register the loader script via Zid's storefront script API using the manager token; store returned id.
- `supabase/functions/zid-oauth-webhook/index.ts`: on `app.uninstalled`, delete the saved script id; also investigate the current `invalid signature` rejections.
- `src/app/components/settings/StoreInfo.tsx` (or new `WidgetInstall.tsx` tab): render copy-paste snippet pre-filled with the tenant's `store_id`/`store_uuid`.
- `supabase/functions/send-password-reset/index.ts`, `send-login-notification/index.ts`, `_shared/provision-merchant.ts`, `_shared/resend.ts`: swap `ar-SA` date/time formatting to `en-GB` with `timeZone: "Asia/Riyadh"`.
- `supabase/functions/zid-token-refresh/index.ts`: widen cutoff to 60 days, include `redirect_uri`, write `last_refreshed_at`, and use returned `expires_in`.
- Confirm/adjust the pg_cron schedule for `zid-token-refresh` to daily.
