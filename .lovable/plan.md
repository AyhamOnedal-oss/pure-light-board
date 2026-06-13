# Three Dashboard Fixes: No Polling, AI Close Label, Goal Score Logic

## 1. Remove 5-second polling — use Realtime + focus only

Two pages still poll the database on a timer, which is what causes "the page refreshes every 5 seconds":

| File | Current poll | Change |
|---|---|---|
| `src/app/components/TicketsPage.tsx` (line ~240) | `setInterval(loadTickets, 15000)` | Remove. Realtime channel on `tickets_main` + `tickets_activities` is already set up and covers every change. Keep a one-shot reload on `visibilitychange → visible` and `window.focus` as a safety net. |
| `src/app/components/Layout.tsx` (line ~76) | `setInterval(onFocus, 5000)` bumping the sidebar badge version | Remove. Replace with a Supabase Realtime channel filtered by `tenant_id` that listens for INSERTs on `conversations_main` and `tickets_main` and triggers `setBadgeVersion(v=>v+1)` (debounced 400ms). |
| `src/app/components/Layout.tsx` (line ~109) | `setInterval(load, 8000)` to refresh badge counts | Remove. The same Realtime channel above already triggers a reload via `badgeVersion`. Keep the initial `load()` + the existing focus listener. |

`ConversationsPage.tsx` was already cleaned up in the previous turn (no poll, silent background refresh). Verify it still subscribes only to Realtime + focus events.

## 2. Always show the close reason — including "Closed by AI"

In `src/app/components/ConversationsPage.tsx` (line ~478) the close-reason badge is hidden whenever the conversation has a ticket:

```tsx
{selected.chatStatus === 'closed' && selected.closeReason && !selected.hasTicket && (...)}
```

That's why an AI-closed conversation that also opened a support ticket shows no "Closed by AI" pill.

Changes:
- Drop the `!selected.hasTicket` condition so the badge always renders when there is a `close_reason`.
- Extend `closeReasonMap` to cover all reasons written by the backend that currently fall through to nothing:
  - `ai_offer_close` → en: "Closed by AI", ar: "أُغلقت بواسطة الذكاء", icon: `Bot`
  - `user_end_conversation` → en: "Ended by customer", ar: "أنهاها العميل", icon: `User`
  - keep existing `customer_manual`, `ai_request` (relabel ar to "أُغلقت بواسطة الذكاء"), `idle`.
- Render the same pill in the list-row tooltip (line ~401) without the `!c.hasTicket` guard.

No schema changes needed — `close_reason` is already stored.

## 3. Fix "Goal Achievement" so it respects rating + outcome

Problem: `completion_score` (and `goal_met`) come from one LLM call in `supabase/functions/classify-conversation/index.ts` that runs the moment the conversation closes. CSAT rating arrives later (or not at all), so a chat can be scored 90% even though the customer rated 1★.

Two-part fix:

### a. Cap the model's score by CSAT when present (Postgres trigger)

Add a `BEFORE UPDATE` trigger on `public.conversations_main` (`enforce_completion_vs_rating`) that runs whenever `csat_rating`, `completion_score`, or `goal_met` is written. Rules:

```text
rating 1 → cap completion_score at 15, force goal_met=false
rating 2 → cap completion_score at 35, force goal_met=false
rating 3 → cap completion_score at 60
rating 4 → cap completion_score at 85
rating 5 → no cap
```

This guarantees that the moment a customer submits a low rating, the dashboard pill updates automatically — no re-classification needed. It also fixes historical rows when their rating row is updated.

A second one-shot `UPDATE` in the migration applies the same rules to every existing row so chats like `7e846491…` correct themselves immediately.

### b. Feed the rating to the classifier when it's already known

In `classify-conversation/index.ts`:
- When loading the conversation, also select `csat_rating` and `rating_comment`.
- If a rating is present, append a "Customer rating: N/5 — <comment>" line at the top of the transcript and add a sentence to the system prompt: *"If a customer rating is provided, it must dominate `completion_score` and `goal_met` — 1–2 stars means the goal was NOT met."*
- After parsing the model's JSON, apply the same cap function as the trigger before the `UPDATE`, so the value written is already consistent.

## Technical notes

- The Realtime tables (`conversations_main`, `tickets_main`, `tickets_activities`) are already in `supabase_realtime`; no new publication grants needed.
- The trigger is the source of truth — the edge-function cap is just an optimization so the first write is already correct.
- No UI strings need translation beyond the closeReasonMap additions.

## Out of scope

- Widget bundle, ticket notes, and rating-screen timer (handled earlier).
- Re-running historical classification — only the score caps will be back-applied.
