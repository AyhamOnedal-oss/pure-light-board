## Goal
Make `/dashboard` feel live immediately on entry/reload:
- No 2–3 second blank/zero delay.
- No cached number like `2K` dropping to `0` then counting back up.
- Dashboard cards/charts enter together in one smooth gradual choreography.

## Plan

1. **Stop permission loading from wiping dashboard metrics**
   - In `DashboardPage`, stop passing `permissionsLoading` as `frozen` into `useDashboardMetrics`.
   - Only use actual inactive-member state (`isFrozen`) for frozen dashboard snapshots.
   - Keep the date controls visually disabled while permissions are loading, but do not reset metrics because of it.

2. **Make cached metrics the first paint source**
   - Keep the existing last-tenant cache behavior, but harden `useDashboardMetrics` so it never replaces cached/live metrics with `EMPTY_METRICS` during temporary states like missing tenant, permission loading, or frozen snapshot not ready.
   - If no cache exists, return a proper `loading` state instead of rendering fake zero data.

3. **Prevent first-render zero numbers entirely**
   - Update the dashboard rendering so KPI numbers only mount once there is real data or cached data.
   - On first real data arrival, show the final values directly with the page entrance animation, instead of animating `0 → value`.
   - After the dashboard is already live, keep normal number animations for real updates, but avoid dramatic downward-to-zero transitions caused by temporary empty data.

4. **Add one coordinated dashboard entrance animation**
   - Add a parent motion container for the KPI grid and chart grid using staggered children.
   - Cards should fade/slide in gradually as a group, not wait for each query separately.
   - Charts should animate only on the initial dashboard entrance; later realtime updates should update in place.

5. **Use polished loading placeholders only for first-ever load**
   - If the user has no cache yet, show stable skeleton/shimmer blocks with the same card dimensions.
   - Replace them with the real dashboard in one fade transition once data arrives.
   - This avoids showing incorrect zeros while still making the page feel responsive.

## Technical details
- Main files: `src/app/components/DashboardPage.tsx`, `src/app/hooks/useDashboardMetrics.ts`, `src/app/components/AnimatedNumber.tsx`.
- Root issue: `freezeDashboard = permissionsLoading || isFrozen` causes `useDashboardMetrics` to enter frozen mode during permission resolution, which can set `EMPTY_METRICS`; that is why cached `2K` drops to `0` before real metrics return.
- The fix is frontend-only; no SQL/backend changes needed.