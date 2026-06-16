## Plan

Make the Tickets sidebar badge count the same unread ticket-note notifications the user sees in the Notes/bell area, not all notes and not just distinct tickets.

### Changes

1. **Use notification rows as the source of truth**
   - In `Layout.tsx`, calculate the Tickets sidebar badge from unread `app_notifications` that represent a ticket/note message.
   - Only count notifications that are still unread for the current user.
   - Exclude normal notifications like subscription, word limit, admin messages, etc.

2. **Make each note notification decrease the badge when clicked**
   - When clicking a notification that belongs to a ticket/note, mark that notification as read.
   - Trigger the sidebar badge reload immediately so the count changes from 10 → 9 → 8, etc.
   - Because `markRead` writes to `app_notifications.read_by`, the decreased number stays after refresh.

3. **Keep note-panel behavior separate**
   - Opening a ticket’s notes panel can still mark that ticket’s note activity as seen for the red note indicator.
   - The sidebar badge will follow unread ticket-note notification count, as requested.

### Technical details

- Update `AppContext.tsx` notification mapping to include enough metadata (`kind` and/or payload fields if present) to identify ticket notifications.
- Update `Layout.tsx` sidebar badge logic to count unread ticket-note notifications from `notifications` instead of querying `tickets_activities`.
- Update the bell notification click handler to dispatch `fuqah:badges-bump` after `markRead(n.id)` so the Tickets badge refreshes immediately.
- If the notification has a ticket id in its payload, optionally navigate/open the relevant ticket context only if the existing data supports it safely; otherwise only mark read and decrement.