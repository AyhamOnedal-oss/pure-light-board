## Problems found

1. **"تصنيف المحادثات" chart + Completion Rate are wrong** — the `dashboard_metrics` RPC groups by `(status, category)` and then uses `jsonb_object_agg(category, n)` and `count(*) filter (...)` on those grouped rows. Duplicate category keys collide (Postgres keeps only the last value), and the completion rate counts group rows instead of conversations. DB data has 8 categories (inquiry 639, complaint 324, refund 210, shipping 210, request 30, suggestion 9, other 253, null 1365) but the chart only shows request + inquiry.

2. **Avg Response Time is 0** — the RPC sets `avgResponseSeconds := 0` and never computes it. The client-side fallback computes from messages but only over the current window; when message rows are sparse or sender names differ, it stays 0.

3. **AI feedback list shows date instead of conversation id; modal shows `#—`** — the join uses `conversations_main.display_code`, but every row in `conversations_main` has `display_code = NULL`, so the code prints `'—'`. The user wants the conversation id shown.

## Plan

### 1. New migration: fix `public.dashboard_metrics` RPC
Rewrite the completion-rate + classification CTE so the chart matches the conversations themselves:

```sql
with c as (
  select status, category
  from public.conversations_main
  where tenant_id = _tenant and is_test = false
    and created_at >= _from and created_at <= _to
)
select
  case when count(*) > 0
    then count(*) filter (where status in ('resolved','closed'))::numeric / count(*)
    else 0 end
into v_completion
from c;

select coalesce(
         jsonb_object_agg(category, n) filter (where category is not null),
         '{}'::jsonb)
into v_classification
from (
  select category, count(*)::int as n
  from c
  group by category
) g;
```

Also compute `v_avg_response` server-side from `conversations_messages` using consecutive `customer → ai|agent` pairs within each conversation (cap individual gaps at 3600s, ignore negatives), so the KPI is non-zero even when the client fallback is empty.

### 2. `src/app/components/DashboardPage.tsx`
- Replace `allowedClassifications` with the full set actually present in the data: `inquiry`, `complaint`, `request`, `suggestion`, `shipping`, `refund`, `product`, `payment`, `other`. Keep the existing color map (already defined). This makes the donut reflect every real conversation category, not just 4.
- In the AI feedback list (around line 691-695), replace the date line with the conversation id label:
  ```
  {t('Conversation', 'المحادثة')} #{shortConvId(row)}
  ```
  where `shortConvId(row) = row.conversation_code ?? row.conversation_id.slice(0, 8)`.
- In the feedback modal footer (line 753), use the same helper so it shows `#<short id>` instead of `#—`.

### 3. `src/app/services/metrics.ts`
- Keep the existing `conversation:conversations_main!messages_conversation_id_fkey(display_code)` join (still useful once codes exist) but expose `conversation_id` (already in the interface) so the UI can fall back to a short uuid when `display_code` is null. No interface change needed.

## Verification
- After the migration, query `dashboard_metrics` for the active tenant and confirm `classification` includes all categories with their full counts, `completionRate` matches `resolved+closed / total` from a direct query, and `avgResponseSeconds > 0` when there are AI replies.
- Reload `/dashboard` and confirm the donut shows the full breakdown, Completion Rate matches the real ratio, Avg Response Time is non-zero, and each row in تقييم رسائل الذكاء + the رد الذكاء modal shows `#<conversation id>`.
