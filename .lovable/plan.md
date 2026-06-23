## Goal

Make the Tickets sidebar badge follow the lifecycle:
- New ticket raised → +1
- Ticket opened/clicked by user → that ticket's contribution drops to 0
- Ticket closed → stays 0 (was already 0, or just got cleared)
- Ticket reopened (status `closed` → `open`) → +1 again

## Current behavior (why reopen doesn't re-bump)

`src/app/components/Layout.tsx` (lines 143–215) computes the badge as:
- For each ticket, if `seen == 0 OR created_at > seen` → +1.
- Plus unread notes.

`seen` is `localStorage[ticketNotesSeen[uid][tid]]` and only ever moves forward (gets set to `now()` when the user opens the notes panel). It's never reset. So once the user has seen a ticket, reopening it later does nothing — `created_at` never changes, `seen` is already > it.

Also, clicking the ticket row itself (`handleSelect` in `TicketsPage.tsx` line 340) does NOT mark it as seen — only opening the Notes panel does. So the user's "clicked → 0" expectation isn't actually wired up today either.

## Fix

Use the existing `tickets_activities` rows of `type='status'` (the toggle handler already writes `status='open'`/`'closed'` on reopen/close) as the source of truth for "last raised/reopened time".

### 1. `src/app/components/Layout.tsx` — sidebar badge

Replace the unread-ticket loop so that for each ticket:

- Skip if its current status is `closed` / `resolved` (those don't contribute).
- Compute `lastOpenedAt = max(activity.created_at where type='status' and status in ('created','open')) ?? ticket.created_at`.
- If `lastOpenedAt > seen` → +1.

This means:
- New ticket → `lastOpenedAt = created_at`, `seen = 0` → +1.
- User clicks the ticket → `seen = now()` → no longer counted.
- Closed → excluded by status filter regardless.
- Reopened → new activity row with `status='open'` and a fresh `created_at` > `seen` → +1 again.

Realtime listeners on `tickets_main` and `tickets_activities` already exist, so the badge recomputes automatically.

Notes block stays as-is (notes newer than `seen` still count).

### 2. `src/app/components/TicketsPage.tsx` — clicking a ticket marks it seen

In `handleSelect` (line 340), also call:
```ts
setTs(notifKeys.ticketNotesSeen(CURRENT_USER.id, tk.id));
window.dispatchEvent(new Event('fuqah:badges-bump'));
```
so a single click on the ticket row drops it from the badge (the user's "clicked → 0" rule). Notes-panel open keeps doing the same thing.

### 3. `src/app/components/TicketsPage.tsx` — per-row indicator parity

`unreadCount` and `isNewTicket` currently use `seen === 0` as the "fresh ticket" signal, which never re-fires after reopen. Switch both to compare against the same `lastOpenedAt` (derived from the ticket's status activities, which `loadTickets` already fetches into `tk.activities`). A row counts as "new/reopened-unseen" when `lastOpenedAt > seen`.

### Backend / schema

No migration needed. `tickets_activities` already has the `status='open'`/`'closed'` rows we need, and `toggleStatus` already inserts a fresh row on every reopen. No new columns, no new policies, no new edge functions.

## Verification

Manual sequence on the live dashboard:

1. Raise a ticket from the widget → sidebar badge `+1`, row shows the dot.
2. Click the ticket row → badge `-1`, dot clears.
3. Open the ticket and close it → badge stays `0`.
4. Toggle the same ticket back to open → sidebar badge `+1` again, row dot reappears.
5. Click it again → back to `0`.
6. Repeat close/reopen → badge oscillates `0 → +1 → 0` as expected.

Multi-ticket: do the same flow on two tickets in parallel and confirm the badge tracks the sum and updates over realtime without a page refresh.