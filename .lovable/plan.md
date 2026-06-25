
## Correction

Got it — the notification lives **inside the ticket's Notes drawer** (the red `1` on the "ملاحظات" button). I misread it as the bell. Fully reverting the DB work and fixing the badge only.

## 1. Roll back the database changes I made

Single migration:

```sql
DROP TRIGGER IF EXISTS trg_notify_ticket_status_event ON public.tickets_activities;
DROP FUNCTION IF EXISTS public.notify_ticket_status_event();
```

Also restore `public.admin_kpis` to its previous version (counting non-admin auth users) so the Total Customers KPI returns to what it was before. Enum values `ticket_opened` / `ticket_closed` stay (Postgres can't drop enum values without rebuilding the type) — they're unused and harmless.

No `app_notifications` rows were inserted by the trigger yet (you only tested open/close after the fact), so nothing to clean up there. If any did slip in, the migration will also `DELETE FROM public.app_notifications WHERE kind IN ('ticket_opened','ticket_closed')`.

## 2. Fix the ticket Notes badge — frontend only

**File:** `src/app/components/TicketsPage.tsx`, function `unreadCount(tk)`

Today: `ticketUnread = lastStatusAt > seen ? 1 : 0` — caps at 1.

Change: count **every** `tk.activities` entry where `type === 'status'` and `status ∈ {open, closed, created, resolved, in_progress}` and `timestamp > seen`. Add that to the existing note count. Result: open → close → open shows `3`; open → close → open → close → open shows `5`.

**File:** `src/app/components/Layout.tsx` — sidebar Tickets badge

Mirror the same logic: sum every status row newer than the ticket's `seen` timestamp instead of `+1` per ticket. Notes loop stays unchanged.

## Acknowledge rule (unchanged)

Opening the Notes drawer sets `notifKeys.ticketNotesSeen = now`, clearing the badge. Selecting the ticket does **not** clear it. Same as today.

## Out of scope

- No DB schema changes for the badge logic — uses existing `tickets_activities` rows.
- Admin panel untouched.
- Bell dropdown untouched.
