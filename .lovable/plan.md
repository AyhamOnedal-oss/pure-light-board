## Goal

Make the red Tickets sidebar badge match the per-row "unread notes" indicator inside the Tickets page, and make "opening a ticket's notes" permanently clear it (survives refresh — which it already does via `localStorage`, we just need the count to drop correctly).

## Current behavior (why it shows "1")

- `Layout.tsx` counts **every note row** whose `created_at > ticketNotesSeen[ticketId]`.
- That means a ticket with 3 unread notes contributes 3 to the badge, and ticket-row indicators on the Tickets page use a different rule, so the two numbers don't line up. Right now only one note in the whole tenant happens to be newer than its ticket's `seen` timestamp, so the sidebar shows `1` while several ticket rows still display a note indicator.

## New behavior

- Badge = **number of tickets that have at least one unread note** (one per ticket, not per note). This matches what the user sees as red dots on ticket rows.
- Opening a ticket's notes panel writes `ticketNotesSeen[ticketId] = now()` (already implemented in `openNotes`). The sidebar listens to `fuqah:badges-bump` / `badgeVersion`, so the badge drops by 1 immediately and stays dropped after refresh because the timestamp is persisted in `localStorage`.
- A new customer note arriving later (realtime INSERT on `tickets_activities`) re-increments the badge for that ticket — expected and desired.

## Files

- `src/app/components/Layout.tsx` — change the reducer in the tickets-badge `useEffect` to count **distinct `ticket_id`s** that have any note with `created_at > getTs(notifKeys.ticketNotesSeen(CURRENT_USER_ID, ticket_id))`, instead of summing all unread notes. No other logic, query, or subscription changes.

## Out of scope

- No DB or migration changes.
- No changes to `TicketsPage` per-row indicators, `openNotes`, or the bell dropdown.
- No reset of existing `localStorage` seen entries.