# Fix the red sidebar badges (Conversations + Tickets)

## Current behavior (bugs)

**Conversations badge** — `Layout.tsx` counts a conversation as "unread" only when there's no `fuqah.notif.<uid>.conversations.open.<convId>` key in `localStorage`. Once you click a conversation, that key is set and never cleared, so:
- the badge can only ever go down,
- new customer messages on an already-opened conversation never re-raise it,
- and after a refresh, opened conversations stay "read" forever.

**Tickets badge** — same broken pattern (`ticketOpened.<id>`), but the user has redefined what this badge should mean: it should not track tickets at all. It should track the **"تم فتح تذكرة جديدة"** bell notification ("Storefront visitor — new ticket opened"), and only decrement when the user opens that **notification** (from the bell), not when they open the related conversation/ticket.

## Target behavior

### Conversations badge
Count = number of conversations where **the most recent customer message** is newer than the last time the current user opened that conversation.

- New customer message → conversation becomes "unread" again, even if previously opened.
- Opening the conversation stamps `conversationOpened` = now, so it drops out of the count.
- Survives refresh because both timestamps are persistent (customer ts from DB, opened ts from localStorage).

### Tickets badge
Count = number of **unread "new ticket" notifications** in the bell for this user.

- When a ticket is inserted into `tickets_main` (realtime), push a bell notification: title "New ticket opened" / "تم فتح تذكرة جديدة"، message "Storefront visitor — <ticket code>". Tag the notification with `kind: 'ticket_new'` and `ticketId`.
- Badge counts notifications where `kind === 'ticket_new' && !read`.
- Marking that notification read (clicking it in the bell dropdown, or "mark all read") decrements the badge. Opening the ticket or the conversation does **not** touch the badge.
- De-dupe via the notification's `ticketId` so the same insert event isn't pushed twice across tabs/refreshes (persisted set in `localStorage`).

## Implementation

### 1. `src/app/components/Layout.tsx` — conversations badge query
Replace the current "no opened-key" filter with a per-conversation comparison:

- Fetch `id, last_customer_message_at` from `conversations_main` (limit 500, tenant + `is_test=false`).
- For each row, `unread = toMs(last_customer_message_at) > getTs(conversationOpened(uid, id))`.
- If `last_customer_message_at` is missing on existing rows, fall back to `last_message_at` (already selected today). Long-term we'll rely on the new column (see §3).
- Keep the existing realtime subscription on `conversations_main` INSERT/UPDATE so a new customer message bumps the badge live.
- Remove the tickets query/filter from this effect (tickets badge is now derived from notifications, not from the DB here).

### 2. `src/app/components/Layout.tsx` + `AppContext` — tickets badge from notifications

- In `Layout.tsx`, derive `ticketsBadge = notifications.filter(n => n.kind === 'ticket_new' && !n.read).length`.
- In `AppContext.tsx`:
  - Extend `Notification` with optional `kind?: 'ticket_new' | string` and `ticketId?: string`.
  - Add a tenant-scoped realtime subscription on `tickets_main` INSERT. On each insert, call `pushNotification({ kind: 'ticket_new', ticketId, title: 'New ticket opened', titleAr: 'تم فتح تذكرة جديدة', message: 'Storefront visitor — <code>', messageAr: 'زائر المتجر — <code>' })`.
  - De-dupe with a `localStorage` set `fuqah.notif.<uid>.ticket_new.seen` keyed by `ticketId`, so refreshing or multi-tab doesn't re-push.
  - On initial mount, also backfill: fetch tickets created in the last 24h that aren't in the seen set and push them once (so the bell isn't empty after a fresh login).

### 3. Migration — add `last_customer_message_at` for accurate conversation unread

Add a column + trigger so the conversations badge has an authoritative "latest inbound message" timestamp instead of conflating it with agent/AI replies:

```sql
ALTER TABLE public.conversations_main
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz;

-- Backfill
UPDATE public.conversations_main c
SET last_customer_message_at = sub.ts
FROM (
  SELECT conversation_id, max(created_at) AS ts
  FROM public.conversations_messages
  WHERE sender = 'customer'
  GROUP BY conversation_id
) sub
WHERE sub.conversation_id = c.id;

-- Trigger to keep it current
CREATE OR REPLACE FUNCTION public.bump_last_customer_message_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.sender = 'customer' THEN
    UPDATE public.conversations_main
       SET last_customer_message_at = NEW.created_at
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_bump_last_customer_message_at
AFTER INSERT ON public.conversations_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_last_customer_message_at();
```

No new tables → no GRANT changes needed.

### 4. Cleanup

- Delete the unused `ticketOpened` write in `TicketsPage.tsx` (we no longer use it for the sidebar badge, but `ticketNotesSeen` stays as it drives the per-ticket notes red dot).
- Keep `conversationOpened` writes in `ConversationsPage.tsx` — they're now the "last seen" stamp the badge compares against.

## Files touched

- `src/app/components/Layout.tsx` — conversations badge logic; tickets badge derived from notifications; remove tickets DB query.
- `src/app/context/AppContext.tsx` — `Notification.kind`/`ticketId`, realtime ticket-new subscription, de-dupe + 24h backfill, persistence.
- `src/app/components/TicketsPage.tsx` — drop the now-unused `ticketOpened` setTs call.
- One new migration adding `conversations_main.last_customer_message_at` + trigger + backfill.

## Out of scope

- Changing what the bell notifications dropdown looks like.
- The per-ticket "new note" red dot inside the Tickets page (already correct via `ticketNotesSeen`).
- Cross-device sync of "opened" timestamps (still localStorage-per-browser, as today).
