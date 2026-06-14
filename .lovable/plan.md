## Plan

1. Update the plans usage donut so it uses the same Recharts setup as `تصنيف المحادثات`:
   - Remove the delayed `chartReady` render gate.
   - Remove the forced `key` remount.
   - Keep the `Pie` mounted normally so Recharts performs its native sweep animation instead of popping in.

2. Keep the existing plans chart UI intact:
   - Preserve hover tooltip behavior.
   - Preserve active slice highlight.
   - Preserve current colors, labels, center percentage, and usage counters.

3. Verify the result on `/dashboard/settings/plans`:
   - The donut should animate as a smooth sweep like `تصنيف المحادثات`.
   - It should no longer pop up suddenly.