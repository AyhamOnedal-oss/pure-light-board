
# Notification bell: only show real events

Per the screenshot, the bell currently shows mock "تم فتح تذكرة جديدة" entries. Tickets must not appear in the bell at all. The bell should only show:

1. Word balance approaching limit (80%)
2. Word balance ended (100%)
3. Subscription renewed / extended
4. Messages broadcast by the super-admin from the admin panel

## Database

Create a new table `app_notifications` that backs the bell, plus inserts from existing notification triggers.

```sql
CREATE TYPE public.app_notification_kind AS ENUM
  ('word_limit_warning', 'word_limit_reached', 'subscription_renewed', 'admin_message');

CREATE TABLE public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  kind public.app_notification_kind NOT NULL,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  message_en text NOT NULL,
  message_ar text NOT NULL,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of user_ids who read it
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.app_notifications (tenant_id, created_at DESC);

GRANT SELECT, UPDATE ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read tenant notifications"
ON public.app_notifications FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "members update tenant notifications"
ON public.app_notifications FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
```

Extend existing triggers to also insert a row:

- `bump_word_usage`: when low-balance branch fires → insert `word_limit_warning`; when service-paused branch fires → insert `word_limit_reached`.
- `notify_subscription_renewed`: when renewal fires → insert `subscription_renewed`.

(Keep emails as today; just add the insert next to the `net.http_post` call.)

## Edge function

Add `broadcast-admin-notification` — verifies caller is super-admin via JWT + `auth_user_roles`, accepts `{ title, message }`, then inserts one `admin_message` row per active tenant using the service-role client.

## Frontend changes

`src/app/context/AppContext.tsx`
- Delete `defaultNotifications`, the localStorage `BROADCAST_KEY` cache, and the `storage` sync effect.
- Replace `notifications` state with rows fetched from `app_notifications` for the current `tenantId` (super-admin: limit to their own personal tenant or last 50 across all — we'll scope to current tenant for simplicity).
- Subscribe to realtime inserts/updates on `app_notifications` filtered by `tenant_id`.
- `markRead(id)`: update row's `read_by` to append `user.id` (idempotent).
- Remove `markTicketNotificationRead` (or no-op it for backward compat) and remove the `ticket_new` / `ticketId` typing.
- `pushNotification`: only used by AdminLayout — change it to call the new edge function instead of mutating local state.

`src/app/components/Layout.tsx`
- Remove `ticketsBadge` derived from `notifications.filter(... kind === 'ticket_new')`. Sidebar Tickets badge becomes `0` (or we wire it to unread `tickets_main` count later — out of scope here). For now, drop the badge.
- Render unread count from new context shape (`!read_by.includes(user.id)`).

`src/app/components/admin/AdminLayout.tsx`
- "Send Notification" form now awaits `pushNotification(...)` which invokes the edge function; toast on success/failure.

`src/app/components/TicketsPage.tsx`
- Remove `markTicketNotificationRead` call (replace with no-op or local bump only); ticket page is unaffected otherwise.

## Out of scope

- Real-time ticket sidebar badge replacement (currently relied on mock `ticket_new`). The sidebar Tickets badge is removed — tickets list still works.
- Notification preferences / dismissal UI changes beyond what already exists.
- Backfill of past events into the new table.

## Verification

1. Existing mock entries no longer appear after refresh.
2. Trigger 80% usage on a test tenant → bell shows "اقتراب من حد الكلمات" once.
3. Renew subscription end date → bell shows renewal entry once.
4. Super-admin sends notification via admin panel → all tenants' bells receive an `admin_message` row in real time.
5. Sidebar Tickets badge no longer derives from mock notifications.
