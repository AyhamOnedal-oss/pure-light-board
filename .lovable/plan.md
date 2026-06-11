## Five fixes across dashboard, widget, and backend

### 18 — Note attachments not viewable by other users
Today `NotesActivityPanel` uploads files via `URL.createObjectURL(file)`. Blob URLs are local to the uploader's browser, so when the row is saved to `tickets_activities.attachment`, no one else can open the link.

Fix:
- Create a private Supabase Storage bucket `ticket-notes` (RLS: tenant members can read/write their tenant's folder).
- On note add, upload the file to `ticket-notes/{tenant_id}/{ticket_id}/{uuid}-{filename}`, then store `{type, fileName, size, contentType, storage_path}` in `tickets_activities.attachment` (drop the blob URL).
- `AttachmentBubble` already accepts a `url`; resolve it on render via `supabase.storage.from('ticket-notes').createSignedUrl(storage_path, 3600)` (cached per render).
- Keep download via blob fetch fallback for cross-origin safety.

### 19 — Text selection invisible on blue AI bubble
AI/agent bubbles use `bg-[#043CC8] text-white`; default browser selection (light blue) blends in.

Fix: add a global `::selection` override scoped to message bubbles in `src/styles/index.css`:
```css
.msg-bubble-ai ::selection { background:#ffd166; color:#0b1220; }
.msg-bubble-ai ::-moz-selection { background:#ffd166; color:#0b1220; }
```
Tag the AI bubble `<div>` in `ConversationsPage.tsx` and `TicketsPage.tsx` with `msg-bubble-ai`.

### 20 — Long links overflow the bubble
Bubbles have `whitespace-pre-wrap break-words` but raw URLs without spaces still escape because `break-words` only breaks at word boundaries.

Fix:
- Add `[overflow-wrap:anywhere]` (or Tailwind `break-all` on URLs) to the bubble container in both `ConversationsPage.tsx` and `TicketsPage.tsx`.
- Render text via a small `LinkifiedText` helper (mirror of widget `MessageTextWithLinks`) that auto-detects URLs and renders them as clickable blue anchors (`text-sky-300` on AI, `text-[#043CC8]` on customer), with `target="_blank" rel="noopener"`.
- Apply the same helper to ticket notes text.

### 21 — Auto-refresh every 5s
Conversations, Tickets, and Notes panel only refetch on user action.

Fix: add a 5-second polling loop in each list/detail page using `useEffect` + `setInterval` that calls the existing fetch functions (`fetchConversations`, `fetchTickets`, `fetchActivities`). Pause polling when the tab is hidden (`document.visibilityState`) and when a modal/edit composer is open to avoid clobbering local input. No realtime channels added — keeps the change minimal.

### 22 — Ticket emails not arriving
Triggers `tickets_main_notify_received` and `tickets_main_notify_status` exist and `_app_secrets` is populated, but both edge functions show **zero logs**, meaning `pg_net.http_post` calls are either never produced or failing before reaching the function.

Fix:
1. Redeploy `send-ticket-received` and `send-ticket-status-updated` (last deploy may pre-date current code; absence of logs suggests stale/missing deploy).
2. Verify the Resend "from" domain (`support@fuqah.net`) is verified in Resend; if not, switch `RESEND_FROM` to `onboarding@resend.dev` until DNS is verified so emails go out.
3. Add lightweight logging in the trigger: capture `net.http_post` request id into a new table `email_dispatch_log(tenant_id, kind, request_id, created_at)` so we can correlate via `net._http_response`.
4. Smoke-test by inserting a test ticket and a status update; confirm rows appear in `net._http_response` with 200 and that recipient inbox receives mail.
5. Audit the other Resend-based functions (`send-password-reset`, `send-password-changed`, `send-login-notification`, `send-service-paused`) — redeploy and verify each template renders and sends.

### Technical files touched
- `src/app/components/chat/NotesActivityPanel.tsx`, `src/app/components/chat/AttachmentBubble.tsx`
- `src/app/components/ConversationsPage.tsx`, `src/app/components/TicketsPage.tsx`
- `src/styles/index.css`
- New helper `src/app/components/chat/LinkifiedText.tsx`
- New Storage bucket `ticket-notes` + RLS migration
- New `email_dispatch_log` table + trigger tweak migration
- Redeploy: `send-ticket-received`, `send-ticket-status-updated`, plus other Resend functions
