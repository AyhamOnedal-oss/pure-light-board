## Goal

Add per-conversation AI quality analysis (completion %, intent, goal-met) that runs **once** when a conversation closes, store results on `conversations_main`, and render them identically inside both the Conversations and Tickets views — without changing how dashboard KPIs are loaded (they stay pure SQL).

## Two parallel tracks

```text
Track A — Dashboard KPIs (already built, untouched)
  conversations_main / messages / tickets / widget_events
        │  pure SQL counts + Realtime
        ▼
  DashboardPage tiles

Track B — Per-conversation AI analysis (new)
  conversation.status flips to "resolved"
        │
  Postgres trigger (extend existing notify_classify_conversation)
        │  pg_net.http_post  →  classify-conversation edge function
        ▼
  OpenAI gpt-4.1-mini-2025-04-14   (system-paid, NOT counted in tenant words)
        │
  UPDATE conversations_main SET
    category, subject, close_reason,
    completion_score, intent_type, goal_met, analysis_done = true
        │
        ▼
  ConversationsPage card + header  ─┐
                                    ├─ same data, same colors, same labels
  TicketsPage card + header  ───────┘
```

## Database changes

Add to `conversations_main`:
- `completion_score` smallint (0–100, nullable)
- `intent_type` text (nullable; one of complaint/inquiry/request/suggestion — already covered by existing `category` column, but kept as a separate explicit field per spec)
- `goal_met` boolean (nullable)
- `analysis_done` boolean NOT NULL DEFAULT false
- index on `(tenant_id, analysis_done)` for safety

The existing `notify_classify_conversation()` trigger already fires on `status → resolved`. We extend the edge function to also write the four new fields, and we guard with `analysis_done = false` so it never reruns. The shared-secret model and pg_net path stay as-is.

## Edge function (`classify-conversation`)

- Switch model to `gpt-4.1-mini-2025-04-14`.
- Skip immediately if `analysis_done = true` (idempotent).
- One OpenAI call, JSON mode, returns:
  ```
  { category, subject, close_reason,
    completion_score (0-100), intent_type, goal_met (bool) }
  ```
- Writes all six fields + `analysis_done = true` in a single UPDATE.
- **Token accounting:** these tokens are spent on the system OpenAI key and are NEVER added to `settings_plans.monthly_words_used` or `conversations_messages.word_count`. Only widget chat replies (already handled in `chat-ai`) charge the tenant.

## Frontend — shared analysis UI

New file `src/app/components/conversation/AnalysisBadges.tsx` exporting:
- `<CompletionPill score={n} />` — colored % chip with the spec's thresholds:
  - ≥90 → green
  - 80–89 → light orange
  - 40–79 → dark orange (covers the 40–70 + 71–79 range)
  - <40 → red
  - `null` → muted "—" (analysis pending)
- `<IntentBadge type={...} />` — complaint / inquiry / request / suggestion (bilingual via `t()`)
- `<GoalMetIcon met={...} />`

Used in **four** places, identical styling:
1. ConversationsPage list card (small pill next to time)
2. ConversationsPage detail header (large pill + intent + goal)
3. TicketsPage list card
4. TicketsPage detail header

Both pages already query `conversations_main` (Tickets joins via `conversation_id`); we extend their `select(...)` strings with the new columns. No duplicate AI work — both views read the same row.

## Visitor naming localization

Replace any hardcoded "Visitor Customer" / blank fallback in both pages and `ChatLogDownload` with `t('Visitor Customer', 'عميل زائر')` so it follows the active language from `useApp()`.

## Out of scope

- Re-classifying historical conversations (only new ones going forward, per earlier decision).
- Sentiment, AI quality avg tile, unique-customers tile.
- Any change to dashboard KPI queries.

## Files touched

- `supabase/migrations/<ts>_conversation_analysis_fields.sql` — new (4 columns + index)
- `supabase/functions/classify-conversation/index.ts` — extend prompt, model, fields, idempotency guard
- `src/app/components/conversation/AnalysisBadges.tsx` — new shared component
- `src/app/components/ConversationsPage.tsx` — load new columns, render badges in card + header, localize visitor name
- `src/app/components/TicketsPage.tsx` — same: load (via conversation join or extra select), render badges, localize visitor name

Approve to implement.