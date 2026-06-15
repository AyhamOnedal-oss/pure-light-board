## Problem

The red badge next to **التذاكر** in the sidebar disappeared. In `Layout.tsx` line 144 it is currently hardcoded:

```ts
const ticketsBadge = 0;
```

It used to be derived from the global bell `notifications` list, but that source was replaced by the database-backed `app_notifications` table (word-limit / renewal / admin broadcasts) — none of which are ticket events. So the sidebar lost its signal.

You want the badge to reflect **ticket notes only** — not all bell notifications, not ticket status changes, not new tickets. Just unread notes on tickets the user has open.

## Fix

Restore the sidebar tickets badge by computing it the same way `TicketsPage` already does for per-row badges, but scoped to **note-type activities** to match your "only for notes" requirement.

### Logic (in `Layout.tsx`)

1. Add a `ticketsBadge` state + effect, mirroring the existing `conversationsBadge` effect.
2. Query `tickets_activities` for the current tenant, filtered to `type = 'note'`, selecting `ticket_id, created_at` (last ~500 rows).
3. For each note, compare `created_at` to `localStorage[notifKeys.ticketNotesSeen(CURRENT_USER_ID, ticket_id)]`. Count notes where `created_at > seen`.
4. Subscribe to realtime on `tickets_activities` (filter `tenant_id=eq.${tenantId}`) and re-run the count, debounced 400ms — same pattern as `conversationsBadge`.
5. Also recompute on `badgeVersion` bumps so that opening a ticket's notes panel (which already calls `setTs(notifKeys.ticketNotesSeen…)` and dispatches `fuqah:badges-bump`) immediately decrements the sidebar count.

### Wiring

Replace line 144 with the new state-driven `ticketsBadge`, leave the `navItems` entry unchanged — it already passes `badge: ticketsBadge`.

## Out of scope

- No DB/migration changes.
- No changes to the bell dropdown (`app_notifications` pipeline stays as-is).
- No changes to `TicketsPage` per-row unread badges — they already work.
- "New ticket" indicators (`isNewTicket`) are not added to this badge; only unread **notes** count, per your instruction.

## Files touched

- `src/app/components/Layout.tsx` — replace hardcoded `ticketsBadge = 0` with a realtime-driven count of unread ticket notes.
