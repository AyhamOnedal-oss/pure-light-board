## What I found

1. **The off toggle is saved correctly**
   - Your current tenant has `bubble_visible = false` in `settings_train_ai`.
   - `widget-config` now returns that value correctly.

2. **But one widget path still ignores it**
   - The lightweight storefront loader has the hide guard.
   - The embedded React widget (`widget/src/app`) fetches `bubble_visible` but does not map it into settings or stop rendering `FloatingWidget`, so it can still show even when off.

3. **Clicks are being counted in the wrong place / not consistently**
   - `widget-events` increments `dashboard_usage_daily.clicks` only when it receives `event: "bubble.click"`.
   - The React widget currently bypasses that function and tries to insert `widget_open` into `widget_events` directly.
   - In the live database, `widget_events` is empty, while `dashboard_usage_daily.clicks` has the counter the dashboard should use.
   - The dashboard KPI currently reads from `widget_events`, not `dashboard_usage_daily.clicks`, so storefront clicks will not show in the KPI reliably.

## Fix plan

### 1. Make the React widget respect the visibility switch
- Add `bubbleVisible?: boolean` to `ThemeSettings`.
- Map `s.bubble_visible` from `widget-config` inside `useFetchChatSettings`.
- In `widget/src/app/App.tsx`, do not render `FloatingWidget` when `settings.bubbleVisible === false`.
- This covers the widget bundle path, not just the loader path.

### 2. Make widget click tracking use one canonical endpoint
- Update `widget/src/app/utils/analytics.ts` so `bubble.click` and `bubble.shown` POST to `/functions/v1/widget-events` with:
  - `event: "bubble.click"` / `"bubble.shown"`
  - `tenant_id`
  - `platform`
  - `store_id`
  - `conversation_id`
- Stop direct writes to `rest/v1/widget_events` for those launcher events.
- This keeps the existing service-role Edge Function responsible for incrementing `dashboard_usage_daily.clicks`.

### 3. Make the dashboard KPI read the correct counter
- Update `src/app/services/metrics.ts` so `widgetClicks` reads/sums `dashboard_usage_daily.clicks` for the tenant.
- Keep the realtime subscription on `dashboard_usage_daily` too, so the KPI refreshes when clicks increment.

### 4. Add a database safety net for older widget bundles
- Add a migration trigger on `public.widget_events`:
  - when a `widget_open` row is inserted, increment `dashboard_usage_daily.clicks`
  - when a `widget_shown` row is inserted, ensure today’s usage row exists
- This prevents old deployed widget versions from losing click analytics.

### 5. Verification
- Query `widget-config` for the current tenant and confirm `bubble_visible: false`.
- Confirm the React widget does not render the launcher when false.
- Send a test `bubble.click` to `widget-events` and verify `dashboard_usage_daily.clicks` increments.
- Confirm the dashboard KPI reads that incremented value.