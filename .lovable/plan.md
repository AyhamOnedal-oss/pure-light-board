## Goal

1. Add a date-range selector at the top of the merchant Dashboard (`/dashboard`) so every KPI, chart, and growth delta is scoped to the selected period.
2. Fix the "تقييم الذكاء الاصطناعي" (AI Feedback) tile that currently shows 0.0% / 0.0% — it should show real counts when data exists and a clear empty state when it doesn't.

## 1. Date-range selector

### UI (top of `DashboardPage.tsx`, beside the page title, RTL-aware)

A single pill button showing the current range label (default: "آخر 30 يوم"). Clicking it opens a popover with:

- اليوم (Today)
- آخر 7 أيام
- آخر 30 يوم  ← default
- آخر 3 أشهر
- آخر 6 أشهر
- آخر سنة
- تخصيص فترة… → reveals two date inputs (من / إلى) + "تطبيق" button

The selected range is held in local state (no URL/localStorage persistence in v1). Selection updates label and triggers a refetch.

### Wiring through to data

- `useDashboardMetrics(range)` accepts a `{ from: Date; to: Date }` argument.
- `fetchDashboardMetrics(tenantId, range)` adds `.gte('created_at', from).lte('created_at', to)` (or `day` for `dashboard_usage_daily`) to every Supabase query that has a timestamp column: `conversations_main`, `conversations_messages`, `tickets_main`, `dashboard_usage_daily`.
- Growth deltas compare the selected range vs the immediately-preceding window of the same length (e.g. last 30 days vs prior 30 days), replacing the hard-coded 7-vs-7 logic.
- Realtime subscription remains as-is; it just calls the same `load()` with the current range.

### Out of scope

- Persisting the range across sessions
- Per-tile range overrides
- Other pages (Conversations, Tickets, Admin) — only `/dashboard`

## 2. AI Feedback tile fix

Root cause: data is correct in the DB and the query is correct; tiles show 0.0% because the current tenant simply has no `feedback` rows in the selected window. The UI also hides the absolute counts, so users can't tell empty from zero.

Changes to the tile in `DashboardPage.tsx`:

- Show absolute counts next to the percentage: `إيجابي 12 (66.7%)` / `سلبي 6 (33.3%)`.
- When `metrics.feedback.total === 0`, replace the donut with a centered empty state: "لا توجد تقييمات في هذه الفترة" and a hint to widen the date range.
- Keep the donut + legend when there is data.

## Technical details

Files touched:
- `src/app/components/DashboardPage.tsx` — add `DateRangePicker` component (inline or new file), wire selected range into `useDashboardMetrics`, update AI Feedback tile.
- `src/app/hooks/useDashboardMetrics.ts` — accept and forward `range`, key the realtime channel by range bounds.
- `src/app/services/metrics.ts` — accept `range`, add date filters to every query, generalize growth comparison to "current window vs prior window of same length".
- New small component `src/app/components/dashboard/DateRangePicker.tsx` for the popover.

No DB / migration / edge-function changes.
