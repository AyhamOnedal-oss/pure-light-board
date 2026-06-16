## Goal
Make Tickets behave like Conversations:
- When a new ticket is raised, show a count on the Tickets sidebar item.
- Show a per-ticket `1` badge in the ticket list for that new ticket.
- If 10 tickets are raised, show `10` beside Tickets.
- When the user clicks/opens a ticket, decrement the sidebar count and remove that ticket's badge.
- Persist the decreased count across refresh.

## Plan
1. **Count unread raised tickets, not only note activities**
   - Update the Tickets sidebar badge in `Layout.tsx` to count tickets from `tickets_main` whose `created_at` is newer than the user's saved `ticketOpened` timestamp.
   - Keep the existing unread note count too, so both raised tickets and new notes can contribute when needed.

2. **Show per-ticket badge for new raised tickets**
   - Update `TicketsPage.tsx` so the ticket list badge uses:
     - `1` for a newly raised unopened ticket
     - plus unread note count if there are note notifications
   - This matches the screenshot case where the ticket exists but no number appears on the ticket row.

3. **Decrement when opened**
   - Keep `handleSelect` saving `ticketOpened` immediately when a ticket is clicked.
   - Dispatch the badge refresh event after opening so the sidebar number updates immediately.

4. **Persist across refresh**
   - Continue using the same localStorage notification keys already used for conversations/tickets, so once a ticket is opened, the decreased count stays saved.

## Technical details
- Files to change after approval:
  - `src/app/components/Layout.tsx`
  - `src/app/components/TicketsPage.tsx`
- No database schema changes needed.
- No visual redesign; only badge/count behavior changes.