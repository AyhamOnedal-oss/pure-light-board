
# Live merchant metrics + single classify endpoint

## Confirmed scope

- All listed metrics live (Supabase Realtime, no polling).
- Add **widget clicks** as a tracked metric.
- نسبة الإكمال = simple resolution rate (no AI).
- **Skip** metric 8 (unique customers), metric 9 (resolved count tile), metric 12 (AI quality avg).
- Sentiment skipped.
- Classifier runs once per conversation, triggered by Postgres when `status` flips to `resolved` (after the موقت الخمول inactivity timer auto-closes the conversation).
- Only new conversations going forward — no backfill.

## Live metric wiring

| # | Tile | Source | Realtime trigger |
|---|---|---|---|
| 1 | عدد المحادثات | `conversations_main` count | INSERT on `conversations_main` |
| 2 | الرسائل (in/out) | `conversations_messages` count by sender | INSERT on `conversations_messages` |
| 3 | الكلمات المستخدمة | sum `conversations_messages.word_count` (sender ai/agent) | INSERT on `conversations_messages` |
| 4 | نقرات الودجت | count `widget_events` where type='widget_open' | INSERT on `widget_events` |
| 5 | متوسط زمن الرد | derived from `conversations_messages` ordering | INSERT on `conversations_messages` |
| 6 | التذاكر | `tickets_main` count by status | INSERT/UPDATE on `tickets_main` |
| 7 | التقييمات / CSAT | `conversations_main.csat_rating` distribution | UPDATE on `conversations_main` |
| 11 | نسبة الإكمال | `resolved / total` from `conversations_main` (pure SQL) | UPDATE on `conversations_main` |
| 10 | تصنيف المحادثات | `conversations_main.category` (filled by classifier) | UPDATE on `conversations_main` |

A single `useDashboardRealtime` hook opens four channels (`conversations_main`, `conversations_messages`, `tickets_main`, `widget_events`) and invalidates the matching React Query keys on each event.

## Architecture

```text
widget ──► Supabase REST  (messages, tickets, ratings, widget_events)
                │
   conversations_main.status → 'resolved'   (set by inactivity auto-close)
                │
        Postgres trigger (pg_net.http_post)
                │
        POST /api/public/classify-conversation
                │
        OpenAI (your key, JSON mode)
                │
        UPDATE conversations_main
          SET category, subject, close_reason
                │
dashboard ◄── Supabase Realtime (postgres_changes)
```

n8n is not used.

## Implementation steps

### A. Migration (one file)

1. New table `widget_events (id, tenant_id, type, conversation_id, metadata jsonb, created_at)` with RLS:
   - anon `INSERT` when `tenant_exists(tenant_id)`
   - tenant members `SELECT` their rows
2. Enable `pg_net` extension.
3. Trigger function `notify_classify_conversation()` on `conversations_main`:
   - `AFTER UPDATE` when `OLD.status <> 'resolved' AND NEW.status = 'resolved'`
   - `pg_net.http_post(url, headers={x-classify-signature: HMAC}, body={tenant_id, conversation_id})`
4. Enable realtime publication for the four tables above.

### B. Single AI endpoint

`src/routes/api/public/classify-conversation.ts`:
- Verify `x-classify-signature` HMAC against `CLASSIFY_WEBHOOK_SECRET`.
- Load transcript with `supabaseAdmin` from `conversations_messages`.
- Call OpenAI with JSON-mode prompt → `{ category, subject, close_reason }`.
- `UPDATE conversations_main` with the result.
- Errors logged server-side; no retry (kept simple).

### C. Frontend

1. `src/app/services/metrics.ts` — one typed function per tile, all using the authenticated browser `supabase` client (RLS scopes by tenant).
2. `src/app/hooks/useDashboardRealtime.ts` — opens the four channels and invalidates query keys per event.
3. `src/app/components/DashboardPage.tsx` — replace hardcoded numbers with these hooks. UI layout untouched.

### D. Widget

- On widget open: direct REST insert into `widget_events` (`type='widget_open'`). Replaces only this single telemetry path. All other widget behavior unchanged.

### E. Out of scope

- Visual redesign of the dashboard.
- Backfill of old conversations.
- n8n.
- Sentiment, AI quality score, unique-customers tile, resolved-count tile.
- Admin panel.

## New secrets needed

- `OPENAI_API_KEY`
- `CLASSIFY_WEBHOOK_SECRET`

## Files touched

- `supabase/migrations/<ts>_widget_events_and_classify_trigger.sql` — new
- `src/routes/api/public/classify-conversation.ts` — new
- `src/app/services/metrics.ts` — new
- `src/app/hooks/useDashboardRealtime.ts` — new
- `src/app/components/DashboardPage.tsx` — wire to live data
- `widget/src/app/utils/analytics.ts` — switch open event to `widget_events` insert

Approve to implement.
