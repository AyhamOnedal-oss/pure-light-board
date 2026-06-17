# Restore count-up & chart animations on the dashboard

The dashboard numbers (KPIs, AI Insights, CSAT average) and the donut/bar charts currently render to their final values immediately. They should animate from `0` up to the final value each time the dashboard mounts or its data refreshes (date-range change, manual refresh, page revisit).

## Root cause

1. `src/app/components/AnimatedNumber.tsx` — `useAnimatedNumber` deliberately **snaps** to the target on first mount and again the first time it sees a non-zero target (`hasMountedRef` / `hasRealValueRef` short-circuits). That logic was added to avoid a `0 → N` flash on cached loads, but it also kills the intended count-up animation on every fresh dashboard load. `AnimatedValue` inherits this behavior, so every `<AnimatedValue value={kpi.value} />` on the dashboard prints the final number with no animation.
2. The Recharts `<Pie>` elements (Classification, AI Feedback) and the ticket-status bars only animate the first time their parent mounts. When the user changes the date range / refreshes, the same Pie instance keeps its prior animated state and re-renders statically (only the AI Feedback pie has a `feedbackAnimationKey`; Classification does not, and neither do the ticket bars).

## Changes

### 1. `src/app/components/AnimatedNumber.tsx`
Rewrite `useAnimatedNumber` so it always animates from `0` to `target` on mount, and animates from previous value to new value whenever `target` changes. Specifically:

- Initial state: `useState(0)` (not `target`).
- On mount: kick off a RAF animation from `0` → `target` using the existing `easeOutExpo` curve and `duration` / `delay` props.
- On subsequent `target` changes: animate from the current displayed value to the new target (current behavior).
- Drop the `hasMountedRef` / `hasRealValueRef` snap branches.

This fixes every consumer at once: the 6 dashboard KPIs, the 5 AI-Insight count cards, the CSAT `3.9` number, and the Plans page word-usage numbers — all of them already use `AnimatedValue` / `useAnimatedNumber`.

### 2. `src/app/components/DashboardPage.tsx`
Force the charts to re-run their entry animation whenever the underlying numbers change (refresh / date-range change):

- **Classification donut** (`<Pie>` around line 293): add `key={\`cls-${classificationData.map(d => d.value).join('-')}\`}` so a data change remounts the Pie and replays its `animationDuration={1200}` sweep.
- **AI Feedback donut** (around line 422): already keyed by `feedbackAnimationKey`; verify the key actually changes when `feedbackPieData` changes — if not, derive it the same way (`positive-negative` value string) so the donut re-animates on every refresh.
- **Ticket-status bars** (around line 329): wrap each bar's `motion.div` with a `key` that includes `d.value` (e.g. `key={\`${d.name}-${d.value}\`}`) so Framer Motion remounts the bar and replays the `scaleY: 0 → 1` growth animation on refresh.
- **CSAT stars** (around line 373): add a `key={metrics.csat.avg}` on the wrapper so the staggered star pop-in replays when the average changes.

No backend, no metrics-service, no data-fetching changes.

## Verification

- Open `/dashboard`, watch every KPI number, AI-Insight number, and the `3.9` CSAT value count up from `0` to their final value on first paint.
- Change the date-range preset (e.g. "Last 7 days" → "Last 30 days") — numbers should re-animate from their previous value to the new value, and the Classification donut, AI Feedback donut, and the three Ticket-Status bars should re-play their entry animation.
- Hard refresh the browser — same count-up + chart sweep happens again.
- Plans page (`/settings/plans`) word-usage `%`, Used, Remaining, and Total Words should also count up from `0` on load (same hook).
