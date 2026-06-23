## Goal

Revert the "click ticket row clears badge" behavior. The red ticket badge should only decrease when the user actually opens the **Notes panel** of that ticket — not when they click the ticket row from the list. Reopen-after-close must still re-add +1.

## Current behavior (after last change)

In `src/app/components/TicketsPage.tsx`, `handleSelect` was updated to call `setTs(notifKeys.ticketNotesSeen(...))` + dispatch `fuqah:badges-bump` on every row click. That makes the badge drop immediately on row click, which the user does not want.

## Fix

### 1. `src/app/components/TicketsPage.tsx` — `handleSelect`

Remove the two lines that mark the ticket as seen and dispatch the badge bump on row click. Row click should only select the ticket and open its detail view — no `seen` write.

The existing logic that marks notes as seen when the user actually opens/views the **Notes panel** (the `NotesActivityPanel` open handler that already calls `setTs(notifKeys.ticketNotesSeen(...))`) stays untouched. That remains the only place the badge for a given ticket clears.

### 2. Keep the reopen lifecycle intact

No changes to `src/app/components/Layout.tsx`. The `lastOpenedAt > seen` logic already handles:
- New ticket raised → +1
- Notes opened → seen advances → −1
- Closed → excluded by status filter
- Reopened → new `status='open'` activity row with fresh `created_at` > `seen` → +1 again

### 3. Per-row indicator (`unreadCount` / `isNewTicket`)

Keep them using `lastOpenedAt > seen` so the row dot mirrors the sidebar badge exactly — appears on new/reopened, clears only when notes are viewed.

## Verification

1. Raise ticket → sidebar +1, row dot on.
2. Click the ticket row (do NOT open notes) → badge stays, dot stays. ✅ (this is what's broken now)
3. Open the Notes panel → badge −1, dot clears.
4. Close the ticket → badge stays 0.
5. Reopen → badge +1, dot returns.
6. Open notes again → back to 0.
