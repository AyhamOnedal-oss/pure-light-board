## Goal
Make the dashboard render smoothly without each card animating in separately or charts restarting whenever data refreshes.

## Root causes
1. **KPI counters always start at 0** — `AnimatedValue` re-animates from zero on every render, so cached values still count up.
2. **Recharts re-animates on every data refresh** — every realtime event creates a new `data` array reference for the Pie/Bar charts, restarting their entry animation (this is the "حالة التذكرة chart starts, then restarts" effect).
3. **KPI cards use a staggered framer-motion `delay: idx * 0.07`** — produces a visible sequential fade-in on every mount.
4. **Chart data arrays are recreated on every render**, breaking Recharts' memoization and forcing re-animation.

## Plan
1. **Stop counters from restarting**
   - Make `AnimatedValue` skip the count-up when the value hasn't actually changed (and on first paint when the dashboard hydrates from localStorage cache).

2. **Stop charts from re-animating on refresh**
   - Set `isAnimationActive` only on initial mount for `PieChart`, `BarChart`, etc. Subsequent data updates apply without restarting the animation.
   - Memoize chart data arrays (`classificationData`, `ticketStatusData`, `feedbackPieData`) with `useMemo` so the same reference is reused when values don't change.

3. **Render all cards together**
   - Remove the staggered `delay: idx * 0.07` on KPI cards (and any insight cards using the same pattern). Use a single short fade-in for the whole grid instead, so the whole dashboard appears at once.

4. **Avoid the 0 → value flash on first load**
   - When `useDashboardMetrics` returns cached data, render immediately with cached values.
   - When there's no cache, render a skeleton placeholder once and replace it with the populated dashboard in one swap (no per-card stagger and no count-up from zero).

## Technical details
Files to update:
- `src/app/components/DashboardPage.tsx` — remove stagger, memoize chart data, set `isAnimationActive` only on first mount, render skeleton when there's no cache.
- `src/app/components/AnimatedNumber.tsx` — skip animation when value is unchanged or when starting from cached state.
- `src/app/hooks/useDashboardMetrics.ts` — expose a `hasCache` / `isInitial` flag so the page can decide whether to animate or render statically.

No backend or schema changes.