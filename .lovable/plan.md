### Problem
The current bucket in `AdminDashboard.tsx` is chosen purely by day count:
- ≤ 2 days → hour, ≤ 14 → day, ≤ 90 → week, else month.

Early in a month "Current Month" spans only 1–2 days → falls into **hour** bucket, so both "المشتركون الجدد عبر الوقت" and "المحادثات والتوكنز" render `03:00 … 21:00` (screenshot). Same happens for short custom ranges.

### Fix — map buckets by filter, not by raw days

| Filter | RPC bucket fetched | Client aggregation | X-axis |
|---|---|---|---|
| Current Month | `week` | none | Week ranges (e.g. `3–9 نوف`) |
| Previous Month | `week` | none | Week ranges |
| Last 3 Months | `week` | pair adjacent weeks → **~6 bi-weekly bins** | Bi-weekly range |
| Last 6 Months | `week` | pair adjacent weeks → **~12 bi-weekly bins** | Bi-weekly range |
| Current Year | `month` | none | Month name |
| Custom | span-based: <14d → day; 14–70d → week; 70–200d → bi-weekly (from weeks); >200d → month | as needed | matches bucket |

Note: no `hour` bucket anywhere anymore.

### Changes (frontend only)

1. `src/app/components/admin/AdminDashboard.tsx`
   - Rewrite `bucketInfo` to key off `dateFilter` first, computing:
     - `fetchBucket` ('week' | 'month' | 'day') passed to RPCs
     - `groupSize` (1 or 2) used to fold consecutive buckets client-side for last_3/last_6/long custom ranges
   - Add helper `aggregateBuckets(rows, groupSize)` that sums numeric fields and keeps the first `bucket_start` of each group as the label anchor. Apply to both `convSeries` → `convSeriesData` and the zid/salla `subsSeries` → `subsSeriesData` memos.
   - Rewrite `bucketLabel` to produce:
     - week / bi-weekly → localized "3–9 نوف" / "Nov 3–9" (start day + end day + short month, using `groupSize` to compute end)
     - month → month name (existing)
     - day → existing short format
   - Drop the `hour` branch entirely.
   - Tick interval: keep readable defaults (`interval="preserveStartEnd"` for week/bi-weekly, monthly stays as-is).

2. No RPC / SQL changes — existing `admin_new_subs_series` and `admin_conversations_series` already accept `'week'` and `'month'`; bi-weekly is a pure client-side fold.

### Out of scope
Server Status, OpenAI Keys, and Server/Service Usage cards (as agreed previously — they stay live-only).

### Suggestions
- For **Last 3 / 6 months**, an alternative is bucket = `month` (3 or 6 dots). I recommend the bi-weekly approach above because you explicitly asked for 6 / 12 intervals and it gives more shape to the curve.
- For **Custom**, I default to the span table above; if you'd rather always pick exactly ~10–12 intervals regardless of span, I can switch to an "n-intervals" strategy instead — say the word.
