# Why the storefront feels slow

The dashboard preview updates instantly because it subscribes to Supabase realtime on `settings_chat_design`. The real merchant storefront does **not**. The Hostinger widget script (`public/widget-4.7.31-hostinger.js`) calls `fetchConfig()` **exactly once** at script boot:

```text
storefront load → fetchConfig() once → render bubble → never refetch
```

So after you change a color and click Save:
1. Save hits Supabase (~150–400ms) — fast.
2. Dashboard preview re-renders via realtime — looks instant.
3. Storefront keeps showing old colors until the customer **hard-refreshes the page**, and even then Hostinger's CDN can serve a stale copy of the `.js` for hours.

There is also a small `Cache-Control: public, max-age=5` on `widget-config` (already reduced from 60s in the last change), but that's no longer the dominant delay.

# Plan — live config refresh in the Hostinger widget

Ship a new `public/widget-4.7.32-hostinger.js` that keeps config in sync without a page reload.

### 1. Refetch on tab focus / visibility

When the customer switches back to the store tab, refetch `widget-config` and diff against the in-memory `settings` object. This is the highest-impact change because most "slow" reports happen when the merchant is testing — they save in the dashboard, then click back to the store tab.

```text
document.visibilitychange (visible) → fetchConfig() → applyConfigDiff()
window.focus                        → fetchConfig() → applyConfigDiff()
```

### 2. Light background poll while tab is visible

Every 20s while the tab is visible, refetch `widget-config`. Stop polling while the tab is hidden so we don't burn battery. With the edge cache at 5s and a 20s interval, traffic is negligible (~3 req/min per open tab, almost all served from CDN).

### 3. `applyConfigDiff(newSettings)` — re-style without rebuilding

Don't re-mount the whole widget. Update only what changed:

- Bubble background/inner color → set CSS vars on the bubble element.
- Position (left/right) → swap anchor class.
- Welcome bubble text / enabled → re-render that one node.
- Inactivity timers → write to `state.inactivityConfig`, no DOM change.
- `bubble_visible=false` → call existing `cleanupWidgetDom()`.
- Logo / icon / store name → swap `src` / `textContent` in the header.

If the chat window is currently open we skip the visual re-style of the open window (to avoid flicker mid-conversation) and only update closed-state UI; the next open picks up the new values.

### 4. Cache‑bust the Hostinger JS itself

Hostinger CDN caches `widget-4.7.31-hostinger.js` aggressively, so when we ship a new version merchants keep the old one. Two parts:

- Publish as `widget-4.7.32-hostinger.js` (new filename → guaranteed fresh fetch). The merchant's snippet stays on the versioned URL until they bump it.
- Document the snippet pattern: `<script src=".../widget-4.7.32-hostinger.js" defer></script>`. Bumping the version number is the supported way to push a new widget build.

### 5. Keep edge cache short

`supabase/functions/widget-config/index.ts` is already at `public, max-age=5, stale-while-revalidate=30`. Leave as is — it bounds worst-case staleness for the new poll/visibility paths to ~5s.

## Technical details

**File touched:** `public/widget-4.7.32-hostinger.js` (new file, copy of 4.7.31 + the changes below). The current `4.7.32` file in the repo is empty (1 byte), so it can be populated.

**`fetchConfig` refactor** — split into two functions:

```text
resolveTenantOnce()  // runs once at boot, sets TENANT_ID
fetchConfigOnly()    // runs whenever we need fresh settings;
                     // skips widget-resolve, just calls widget-config
```

**Subscriptions added at boot (after first fetchConfig):**

```text
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchConfigOnly().then(applyConfigDiff);
});
window.addEventListener('focus', () => fetchConfigOnly().then(applyConfigDiff));
setInterval(() => {
  if (document.visibilityState === 'visible') fetchConfigOnly().then(applyConfigDiff);
}, 20000);
```

**`applyConfigDiff` implementation sketch:**

```text
function applyConfigDiff(s) {
  if (!s) return;
  const changed = {};
  // compare each field against current settings, write into settings,
  // then call small targeted updaters:
  if (changed.widgetOuterColor || changed.widgetInnerColor) restyleBubble();
  if (changed.position) repositionAnchor();
  if (changed.welcomeBubble*) rerenderWelcomeBubble();
  if (changed.bubbleVisible === false) cleanupWidgetDom();
  if (changed.bubbleVisible === true && !bubbleEl) buildBubble();
  if (changed.storeName || changed.storeLogo || changed.storeIcon) restyleHeader();
}
```

The existing render functions in the file (`buildBubble`, `buildHeader`, `buildWelcomeBubble`, `cleanupWidgetDom`) are reused — no new rendering logic.

## Out of scope

- No DB schema changes.
- No dashboard changes — the dashboard preview already updates live.
- No change to `chat-ai` / vision flow.
- We do **not** add Supabase realtime in the widget bundle (would bloat the JS and require auth wiring on the storefront); polling + visibility is enough for a settings-change use case.

## Expected result

After deploy + merchants bumping their snippet to `4.7.32`:

- Switching back to the store tab → new colors within ~1s.
- Tab kept open the whole time → new colors within ≤20s.
- No page reload needed.
