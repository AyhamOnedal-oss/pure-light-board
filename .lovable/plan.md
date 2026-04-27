## Goal

Direct connection to your existing external Supabase project **dash fuqah** (`kyohutbusszojssbgbvw`). No Lovable Cloud. No manual SQL pasting. I run all DDL by connecting straight to Postgres from a one-shot Edge Function, then wire `/dashboard` to live data.

## How it works

| Step | Who | What |
|---|---|---|
| 1 | Me | Request `DASH_FUQAH_DB_PASSWORD` as a secret |
| 2 | You | Open Supabase → Settings → Database → copy password (or reset it) → paste once |
| 3 | Me | Write Edge Function `apply-schema` that uses deno-postgres to connect to `db.kyohutbusszojssbgbvw.supabase.co` and execute `dash_fuqah_v2.sql` |
| 4 | Me | Deploy + invoke it once, confirm success, then delete the function (one-shot tool) |
| 5 | Me | Add `@supabase/supabase-js`, create `src/lib/supabaseClient.ts` from existing publishable key |
| 6 | Me | Refactor `DashboardPage.tsx` → live data |
| 7 | Me | Seed demo store + analytics row + insights |
| 8 | Me | Open `/dashboard` and verify |

## Schema (already drafted in `supabase/schema/dash_fuqah_v2.sql`)

11 tables mapped 1:1 to dashboard widgets:

```text
profiles, user_roles (separate, prevents privilege escalation)
stores, store_members
conversations, messages
tickets (auto TKT-XXXXX)
ratings
insights (powers the modal — 5 categories)
bubble_clicks
daily_analytics  ← drives every KPI/chart
```

`daily_analytics` columns map directly to `DashboardPage.tsx`:

| Widget | Column(s) |
|---|---|
| Conversations / Completion / Tickets / Words / Bubble / Avg response | `total_conversations`, `completion_rate`, `total_tickets` (+ open/closed), `words_consumed`, `bubble_clicks`, `avg_response_time_seconds` |
| Classification pie | `complaints_count`, `inquiries_count`, `requests_count`, `suggestions_count`, `unknown_count` |
| Customer Rating | `total_ratings`, `avg_rating` |
| AI Feedback donut | `positive_feedback`, `negative_feedback` |

Triggers:
- `updated_at` on every mutable table
- `messages` insert → bumps `conversations.message_count` + `last_message_at`
- `tickets` insert → generates unique `TKT-XXXXX`
- `ratings` / `bubble_clicks` insert → upserts today's `daily_analytics` row

## RLS (correctly designed)

- `app_role` enum + `user_roles` table
- `has_role()` and `is_store_member()` SECURITY DEFINER functions (no recursive RLS)
- All store-scoped tables gated by `is_store_member(auth.uid(), store_id)`
- `profiles`: self-only read/update
- Anon role: nothing on PII tables (only insert allowed on `bubble_clicks` for the public widget)

## Frontend wiring

- Replace `utils/supabase/info.tsx` import in service layer with the real `@supabase/supabase-js` client
- `DashboardPage.tsx`:
  - Two queries: today's `daily_analytics` row + grouped `insights`
  - Skeletons while loading; soft empty state per widget before any data exists
  - Keep every Framer Motion animation, color palette, and RTL support intact
- Seed inserts so the dashboard renders immediately on first load

## Out of scope (next, separate tasks)

- Wiring `ConversationsPage`, `TicketsPage`, settings pages
- Edge Function for ingesting live messages / bubble clicks from your widget
- Auth UI hookup against the new `profiles` / `user_roles` model

## Security note

The DB password is full database access. Stored encrypted as a Lovable secret, used only by the one-shot `apply-schema` Edge Function (which I delete after success). You can rotate it in Supabase afterward if you want extra peace of mind.
