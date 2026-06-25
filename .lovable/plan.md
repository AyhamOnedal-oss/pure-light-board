## Goal

Make **خطط العملاء الحالية** (Current Customer Plans) and **نوع الاشتراك الأول** (First Subscription Type) in `/admin` rotate with the exact same sweep animation as **تصنيف المحادثات** and **تقييم الذكاء الاصطناعي** in the user panel.

## Root cause

The user-panel donuts use a memoized `DashboardDonut` / `UsagePieChart` component that:
- is mounted **only after** `chartsLoaded` flips true,
- carries a **`key` derived from the data values** (so any data refresh remounts the chart and replays the sweep),
- uses `isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out"`, `innerRadius={50} outerRadius={78}`, `paddingAngle={4}`, `strokeWidth={0}`.

The admin donuts in `src/app/components/admin/AdminDashboard.tsx` render `<Pie>` inline inside `<PieChart>` with `animationDuration={1200}` and no key derived from data, and the gating uses `{chartsLoaded && <Pie .../>}` inside an already-mounted `<PieChart>`. Recharts often skips the entry animation in that setup, which is why those two donuts appear static.

## Changes (frontend only, `src/app/components/admin/AdminDashboard.tsx`)

1. Add a local `AdminDonut` component that mirrors `DashboardDonut` from `DashboardPage.tsx` line-for-line (same `Pie` props: `innerRadius={50}`, `outerRadius={78}`, `paddingAngle={4}`, `strokeWidth={0}`, `isAnimationActive`, `animationBegin={0}`, `animationDuration={900}`, `animationEasing="ease-out"`, same tooltip style).
   - Accept an optional `innerRadius` / `outerRadius` override so the two cards can keep their current sizes if needed, but default to the user-panel values.

2. Replace the Current Customer Plans donut (around lines 431–440) with:
   ```tsx
   {chartsLoaded && (
     <AdminDonut
       key={`plan-${currentPlansData.map(d => `${d.name}:${d.value}`).join('|')}`}
       data={currentPlansData}
       theme={theme}
     />
   )}
   ```
   Mounted inside the card div (not inside a pre-mounted `<PieChart>`), so the whole chart mounts fresh and the sweep plays.

3. Replace the First Subscription Type donut (around lines 490–499) the same way, with `key={`fst-${firstSubData...}`}`.

4. Leave Customer Source and any other pies untouched (user only flagged these two), unless they suffer the same issue — in which case apply the identical pattern.

5. No data, no business-logic, no token/breakdown changes. Strictly the animation wrapper for those two donuts.

## Verification

- Reload `/admin`, watch خطط العملاء الحالية and نوع الاشتراك الأول sweep in from 0° identical to تصنيف المحادثات in the user panel.
- Change the date range so the data refreshes; both donuts should remount (because of the data-derived `key`) and replay the sweep, matching user-panel behavior.
