
## Goals (merged)

1. Rebuild the Hostinger widget bundle so manual close, CSAT rating, and AI thumbs feedback actually persist — fixes the empty rating/feedback charts in `/dashboard`.
2. Stop the rating screen from running an inactivity countdown that re-closes the conversation.
3. Make ticket notes (and image/file attachments) visible to all teammates in real time, with proper author attribution and reliable download.

---

## 1. Rebuild the Hostinger widget bundle

**Why the dashboard shows no ratings / no AI feedback.** Querying the DB for your current tenant (`4257914d-…bbad68b`, 22 closed conversations matching the screenshots):

| Metric | Value |
|---|---|
| Conversations | 22 |
| Closed | 22 |
| With `csat_rating` | **0** |
| Messages with thumbs `feedback` | **0** |

`src/app/services/metrics.ts` and `public.dashboard_metrics()` already read `csat_rating` from `conversations_main` and `feedback` from `conversations_messages` correctly. The backend (`supabase/functions/widget-events`) already handles `rating.submitted`, `conversation.closed`, and `message.feedback`. The source in `widget/src/` already wires `handleConfirmClose`, `handleRatingSubmit`, and `onFeedbackChange` to those events. The only thing missing is the **deployed Hostinger bundle** — storefronts are still loading the old `widget-4.7.26-hostinger.js` from before that wiring landed.

**Action.**
- Bump `widget/package.json` version to `4.7.26`.
- Run `cd widget && bun install && bun run build` (vite IIFE → `widget/dist/widget.js`).
- Copy the output to `public/widget-4.7.26-hostinger.js` so it ships with the project and is downloadable.

**Manual step you'll do.** Upload `public/widget-4.7.26-hostinger.js` to the same Hostinger path your storefronts load. I can't reach Hostinger from here. If you keep the same filename, add a `?v=2` cache buster.

**Caveat.** Existing closed conversations have no `csat_rating` and cannot be backfilled — only new ratings submitted after the upload will populate the dashboard.

---

## 2. Disable rating-screen auto-close (widget source)

**Cause.** `RatingScreen` receives `inactivitySeconds = themeSettings?.ratingInactivitySeconds ?? 900`. When it expires, `onRatingAutoClose` calls `closeConversation(evCtx, 'rating_skip')`, snapping the widget back. The chat-level `InactivityPrompt` is already correctly gated to `currentScreen === 'chat'`; this is the rating screen's own internal timer.

**Action in `widget/src/app/components/ChatWindow.tsx`.**
- Stop passing `inactivitySeconds` / `onRatingAutoClose` to `<RatingScreen>` (or pass a no-op) so the timer never fires.
- Leave `onRatingSubmit` / `onRatingSkip` unchanged — those are explicit user actions.

This change is rebuilt into the same bundle from step 1, so a single Hostinger upload covers both fixes.

---

## 3. Ticket notes — realtime sharing + author attribution + downloads

### 3a. Realtime sharing

Notes already live in `tickets_activities` with RLS `member_can(tenant_id, auth.uid(), 'tickets')`, so every teammate with `tickets` permission can read them. The reason a teammate doesn't see a new note is that `TicketsPage.tsx` only reloads on its own actions.

**Action in `src/app/components/TicketsPage.tsx`.**
- Add a Supabase Realtime channel inside `useEffect`, filtered on the current `tenant_id`, listening to `postgres_changes` (INSERT/UPDATE/DELETE) on `public.tickets_activities` and `public.tickets_main`. On any event, debounce-call `loadTickets()` (~300 ms). Clean up with `supabase.removeChannel(channel)`.

**Migration.**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_activities, public.tickets_main;` (no-op if already present).
- `ALTER TABLE public.tickets_activities REPLICA IDENTITY FULL;` and same for `tickets_main` so payloads include `tenant_id` for client filtering.

### 3b. Author attribution

`addNote` currently writes `author_name: CURRENT_USER.name`. Switch to the logged-in user's `display_name` from `settings_account` (already in `AppContext`) and persist `author_user_id = auth.uid()` (column already exists).

Scope `editNote`/`deleteNote` by `author_user_id = auth.uid()` instead of `author_name` so edits don't leak across similarly-named teammates.

### 3c. Attachment downloads

`AttachmentBubble.tsx` already resolves `storage_path` via `supabase.storage.from('ticket-notes').createSignedUrl(...)` with a Download button + lightbox download. I'll verify the `ticket-notes` bucket has a tenant-member read policy; if missing, add:

```sql
create policy "ticket_notes_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-notes'
    and public.member_can((storage.foldername(name))[1]::uuid, auth.uid(), 'tickets')
  );
```

---

## Verification

- Sign in as a non-admin teammate in preview, open a ticket, add a note + image → confirm both appear instantly on the admin's panel without refresh and the image downloads.
- After you upload the new bundle, send a message on a storefront, end the chat, submit a 5-star rating, thumbs a message. Re-query the DB to confirm `csat_rating` and `feedback` land, then check `/dashboard` cards.

## Files touched

- `widget/package.json` — version bump to `4.7.26`.
- `widget/src/app/components/ChatWindow.tsx` — remove rating-screen auto-close.
- New file `public/widget-4.7.26-hostinger.js` — built bundle output.
- `src/app/components/TicketsPage.tsx` — realtime subscription, `author_user_id` wiring, edit/delete scoping.
- New migration — realtime publication + replica identity (+ optional storage policy).

## Out of scope

- No changes to dashboard fetch logic, `dashboard_metrics` RPC, or RLS on conversations/messages.
- No backfill of historical conversations' ratings/feedback.
- No changes to ticket permission code (you confirmed it's working).
