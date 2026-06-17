## Plan

1. **Create one reusable dashboard donut component** in `DashboardPage.tsx` that matches `UsagePieChart` from the Plans page line-for-line for the visual behavior:
   - `ResponsiveContainer width="100%" height={200}`
   - `PieChart`
   - `Pie` with `innerRadius={50}`, `outerRadius={78}`, `paddingAngle={4}`, `strokeWidth={0}`
   - `isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out"`
   - Cells mapped from the data exactly like the Plans chart

2. **Replace both dashboard donuts** (`تصنيف المحادثات` and `تقييم الذكاء الاصطناعي`) to use that component instead of inline `<Pie>` code.

3. **Make the donut remount with the same pattern as Plans**, but tied to actual dashboard data:
   - Keep the loaded gate.
   - Add a changing `key` on the chart component using the chart values, so refresh/date-range changes force a fresh mount and replay the counter-clockwise sweep.

4. **Remove unused animation-key variables** if they are no longer needed, so the code is clean.

## Why it is still not moving

The current dashboard charts look similar to Plans, but the actual Recharts `<Pie>` instance can remain mounted/reused inside the dashboard render flow. Recharts only plays the pie sweep on mount, so if React reuses the same component instance, it updates statically. The fix is to make the dashboard donuts use the exact same component/mount pattern as `استخدام الكلمات`, plus a data-based key so React cannot reuse the stale animated pie.