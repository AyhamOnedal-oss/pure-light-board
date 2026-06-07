## Goal

Make the post-close analysis flow match the spec exactly:

1. Any close path (customer / AI / inactivity) closes the conversation and triggers AI classification.
2. Conversation list + card show **category**, **completion %**, and **close method**.
3. Conversations never show priority (correct today — keep it that way).
4. When a ticket is submitted, the conversation is closed and shown simply as "closed" (no customer/AI/inactivity label) and the ticket carries classification + priority + status.
5. Dashboard "Most Frequent…" cards (Inquiries / Requests / Complaints / Suggestions / Unknown) read real classification data and their drill-down lists come from actual conversations + tickets.

## Current state (verified)

- `widget-events` already sets `close_reason` to `customer_manual` / `ai_request` / `idle` and closes the conversation. ✓
- `notify_classify_conversation()` trigger fires `classify-conversation` edge function when status flips to resolved/closed with `analysis_done=false`. ✓
- `classify-conversation` writes `category`, `subject`, `intent_type`, `completion_score`, `goal_met`, `analysis_done=true`. ✓
- `dashboard_metrics` RPC already returns `classification` aggregated by `category`. ✓
- Conversation list shows: completion pill, ticket badge, open/closed badge. **Missing: category badge.**
- Conversation detail header shows intent + close-reason chip — must be hidden when a ticket exists.
- Dashboard "Most Frequent" cards use **hardcoded counts** (`'320'`, `'420'`, …) and **mocked drill-down lists** (`insightIssues`).
- `widget-events` ticket.created path sets `close_reason: "customer_manual"` even though the close was caused by a ticket submission, so the detail view incorrectly shows "Closed by customer".

## Changes

### 1. Ticket submission → conversation shown as just "closed"
File: `supabase/functions/widget-events/index.ts`
- In the `ticket.created` branch, set `close_reason: null` (instead of `customer_manual`) when closing the conversation. Trigger still fires (status flips to closed, analysis_done=false), so AI classification still runs on the transcript.

File: `src/app/components/ConversationsPage.tsx`
- Hide the close-reason chip in the detail header when `selected.hasTicket` is true (only render the plain "Closed" chip).
- Also drop the title tooltip on the list "Chat Closed" pill for ticketed conversations.

### 2. Show category on the conversation list card
File: `src/app/components/ConversationsPage.tsx`
- In the list row badges (around line 304), render a small category pill using the existing `categoryMap` when `c.category` is set: colored background, Arabic/English label, same sizing as the completion pill.
- Order: category → completion → ticket badge → chat status badge.

### 3. Real counts on dashboard "Most Frequent" cards
File: `src/app/components/DashboardPage.tsx`
- Replace the hard-coded `count` values in the `insights` array with values derived from `metrics.classification`:
  - complaints → `classification.complaint ?? 0`
  - requests → `classification.request ?? 0`
  - inquiries → `classification.inquiry ?? 0`
  - suggestions → `classification.suggestion ?? 0`
  - unknown → `classification.other ?? 0`
- Format with `formatNumber()` so it stays consistent with KPI cards.

### 4. Real drill-down lists for "Most Frequent" cards
Files: `src/app/services/metrics.ts`, `src/app/hooks/useDashboardMetrics.ts` (new query), `src/app/components/DashboardPage.tsx`
- Add a new fetch in the metrics layer: for the active tenant + date range, pull from `conversations_main` where `status in ('closed','resolved')` and `analysis_done=true`, selecting `category, subject`. Group client-side by `(category, subject)`, count occurrences, sort desc, take top 8 per category.
- Map results to `{ id, labelEn: subject, labelAr: subject, count, resolved: false }` (subject is already in the conversation's language; we display the single string in both locales).
- Replace the mocked `insightIssues` constant with the live grouped data; the `unknown` bucket uses `category = 'other'` or NULL.
- Keep the existing resolve/delete local-state behavior so admins can dismiss items from the UI session (no DB column needed yet).

### 5. Verify and keep current behavior
- Tickets page already shows classification + priority + status — no change.
- Conversations never render priority — confirmed, no change.
- Classifier already runs on every close path because all three reasons flip `status → closed` and `analysis_done=false`.

## Out of scope

- Persisting "resolved/deleted" state of insight items in the DB.
- Translating customer-written subjects between Arabic/English.
- Re-classifying historical conversations that closed before this flow existed (existing `Re-analyze` admin path already covers that one-off).
