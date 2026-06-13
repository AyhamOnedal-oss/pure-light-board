# Per-Item Sidebar Badge Decrement

## Current behavior

Visiting `/dashboard/conversations` or `/dashboard/tickets` writes a single "list seen" timestamp (`conversationsListSeen` / `ticketsListSeen`) to localStorage. The badge query then counts items newer than that timestamp — so the badge zeroes out the moment the user lands on the list page, even if they haven't opened any individual chat/ticket.

## Desired behavior

The badge equals the number of conversations / tickets the user has not yet **opened individually**. Opening one chat (or one ticket) decrements the badge by exactly one. The badge reaches zero only when every item has been opened at least once.

Per-item "opened" timestamps already exist:
- `notifKeys.conversationOpened(uid, conversationId)` — written by `ConversationsPage` when a chat is selected.
- `notifKeys.ticketOpened(uid, ticketId)` — written by `TicketsPage` when a ticket is selected.

So no schema work — only the badge calculation needs to change.

## Changes

### 1. `src/app/components/Layout.tsx`

- Remove the `setTs(conversationsListSeen/ticketsListSeen)` writes in the `location.pathname` effect (lines 64–72). Keep the `setBadgeVersion` bump so navigating the sidebar still refreshes the count.
- Replace the count-only badge query with an **ID query** scoped to the recent window so it scales:
  - Conversations: `select id from conversations_main where tenant_id=... and is_test=false order by last_message_at desc limit 500`.
  - Tickets: `select id from tickets_main where tenant_id=... order by created_at desc limit 500`.
- Filter client-side: keep only IDs that do **not** have a `conversationOpened` / `ticketOpened` entry in localStorage. Set the badge to that filtered length.
- The Realtime channel stays as is — a new INSERT bumps the badge automatically because the new ID has no opened-key yet.

### 2. `src/app/components/ConversationsPage.tsx` and `TicketsPage.tsx`

- When a row is selected and the per-item `*Opened` timestamp is written (existing code), also dispatch a `window` event `window.dispatchEvent(new Event('fuqah:badges-bump'))`. This is a same-tab signal — `storage` events don't fire in the same tab.

### 3. `src/app/components/Layout.tsx` (listener)

- Add a `window` listener on `'fuqah:badges-bump'` that calls `setBadgeVersion(v => v + 1)`. That re-runs the badge effect, recomputes against the now-updated localStorage, and the badge drops by one.

## Edge cases

- The 500-item cap means once a tenant has more than ~500 historical chats, only the most recent 500 contribute to the unread count. This matches what a human inbox does and avoids loading thousands of IDs into the browser.
- If a user clears localStorage, the badge correctly re-shows everything in the recent window as "unopened" — same as a fresh login.
- Demo/seed runs reset both badges via the existing `is_test=false` filter for conversations and tenant scoping for tickets.

## Out of scope

- Deleting/archiving the legacy `*ListSeen` keys — they simply stop being read.
- Per-message unread counts inside a single conversation (the request is about the sidebar number only).
