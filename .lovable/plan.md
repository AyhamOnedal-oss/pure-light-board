# Fixes for admin KPIs + real token breakdown

## 1. Stop the "mock flash" on refresh

KPI cards currently mount with the MOCK constant, so big mock numbers visibly count *down* to the real values (1247 → 5).

Fix: initial KPI state is `null`. Cards render a `—` skeleton until `admin_kpis()` resolves. `AnimatedValue` then runs once from `0 → real value` (count up only). Mock fallback stays for other charts but is removed from the KPI row.

## 2. Total Customers = 5, not 6

Switch the metric from "zid/salla workspaces" to **"distinct non-admin auth users"** so it matches the Supabase Auth panel. `admin_kpis()` already runs as `SECURITY DEFINER`, so it can read `auth.users`:

```sql
total_customers = (
  select count(*) from auth.users u
  where u.created_at <within range>
    and not exists (
      select 1 from auth_user_roles r
      where r.user_id = u.id and r.role = 'super_admin'
    )
)
```

Same change applied to `prev_total_customers`. Returns 5 today.

## 3. Plans donut not spinning

The "خطط العملاء الحالية" pie animation only plays on first mount, and `currentPlansData` mounts with the MOCK array, so the sweep is wasted before real data arrives.

Fix: reuse the `chartsLoaded` gating pattern already in `DashboardPage`. The Pie is only mounted after data resolves, so the sweep plays once with real numbers. Same gate applied to the other animated pies (First Sub Type, Customer Source) for consistency.

## 4. Replace "Words / Tokens Usage" with a real Token Breakdown

Drop the mock monthly bar entirely. New card uses two real sources:

**A. Chat AI usage — pulled from n8n**
- New edge function `n8n-token-stats` calls the n8n webhook (URL stored as `N8N_TOKEN_STATS_URL` secret) and returns per-tenant token totals for the selected range.
- Buckets: `chat_replies` (n8n chat-ai workflow).

**B. Direct OpenAI usage — pulled from the OpenAI Usage API**
- New edge function `openai-usage` calls `https://api.openai.com/v1/organization/usage/completions` with `OPENAI_ADMIN_KEY` (admin key, not the regular `OPENAI_API_KEY`) for the same date range, grouped by `project_id` or `api_key_id` so we can split:
  - `vision` (image analysis)
  - `user_intent` classifier
  - `reply_intent` classifier
  - `conversation_classification`
  - `ticket_classification`
- We tag each call site by using a distinct OpenAI project (or distinct API key) per bucket. Mapping (project/key → bucket label) lives in the edge function.

**Card UI**
- Horizontal bar list per bucket: label · tokens · % of total · cost (USD).
- Small donut on the side mirroring the same buckets.
- Header total = grand total tokens + grand total $ for the selected range.
- Range = the same top-right date filter.

If the OpenAI Usage API call fails or the admin key is missing, the OpenAI buckets show `—` with a small "configure key" hint instead of zeros, so they're never confused with real-zero usage.

## Secrets needed
- `N8N_TOKEN_STATS_URL` — n8n webhook URL that returns chat token usage.
- `OPENAI_ADMIN_KEY` — OpenAI **admin** API key (sk-admin-…) with `api.usage.read` scope. The existing `OPENAI_API_KEY` does not have access to the Usage API.

I'll request both via `add_secret` after you approve the plan.

## Files
- Migration: update `admin_kpis` (auth.users-based customer count).
- New edge function: `supabase/functions/n8n-token-stats/index.ts`.
- New edge function: `supabase/functions/openai-usage/index.ts`.
- `src/app/services/adminDashboard.ts`: add `fetchTokenBreakdown(from, to)` combining both sources; remove MOCK usage from KPI loader.
- `src/app/components/admin/AdminDashboard.tsx`: KPI loading skeleton, donut gating, replace Words/Tokens card with the new Token Breakdown card.
