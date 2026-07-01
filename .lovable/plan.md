## Diagnosis

All KPI cards are computing correctly against the current data — the **0 values are accurate**, not a bug:

| Card | Value | Why |
|---|---|---|
| إجمالي العملاء | 0 | No workspace is on a paid plan (economy/basic/professional/business/pro). All 17 tenants are still `plan='free'` / `status='trial'`. |
| العملاء النشطون | 0 | Same reason — active = paid + `status='active'`. Trials are excluded by design (you confirmed keeping this). |
| إجمالي إلغاء التثبيت | 0 | Uninstalls are only counted for paid tenants. |
| العملاء غير المكتملين | 0 | The card follows the selected date range. There are 25 candidates all-time (17 trial workspaces + 8 unmatched leads), but none were created inside your currently selected window. |
| عدد المحادثات / نقرات الفقاعة / متوسط الاستجابة | 2 / 2 / 8.7s | Real message + widget-event data lives inside the current range. |

## No code changes required

You confirmed:
- Keep **Active Customers = paid only** (current logic).
- Keep **Incomplete Customers** following the date-range filter.

Both match what `admin_kpis` already returns. As soon as a tenant is switched to a paid plan (via Customer Management → Subscription actions), it will appear in Total/Active. Widen the date range (e.g. "All time" / "Last 90 days") to see the 25 incomplete customers populate.

## If you want a visual hint instead of "0"

Optional follow-up (not part of this plan): show a small "no paid subscribers yet" caption under the 0 values, and/or make the date-range picker default to "All time" on first load so cards don't look empty. Let me know if you'd like either of those.
