## Plan

### 1) Fix manually closed + 5-star conversations still showing open
- Update the widget rating flow so submitting a rating actually calls `postRating(...)` and marks the conversation closed server-side.
- Set the widget `closedRef` when the user manually proceeds to the rating screen so later tab-hide/inactivity events cannot overwrite the close reason.
- Strengthen the dashboard status mapping so any conversation with `csat_rating` or `resolved_at` is displayed as closed even if a stale status row remains open.
- If an existing production row is currently stale, apply a small data update to close only rows that have a rating/resolved timestamp but still have an open-like status.

### 2) Fix employee disable/delete behavior
- Change permission resolution to read `team_members.status` with `permissions`.
- Disabled employee: show a clear disabled-account state instead of making all fields look like missing permissions and freezing pages with stale data.
- Deleted employee: do not leave them as an active tenant member. Remove or deactivate their tenant membership at the same time so they cannot sign into that merchant workspace with a confusing “deleted” state.
- Update tenant selection so deleted/inactive team rows are not used as the preferred workspace.
- Add a database function/RLS adjustment only if required so status-aware permission checks are enforced consistently by the database, not just the UI.

### 3) Add red notification numbers for new conversations/messages/tickets
- Replace the current hardcoded sidebar badges (`0`) with live counts from Supabase.
- Conversations badge: count conversations/messages newer than the user’s last opened timestamp; decrement when that conversation is clicked.
- Tickets badge: count new tickets and/or ticket updates newer than the user’s last opened timestamp; decrement when that ticket is clicked.
- Keep the existing red badge style and local “seen/opened” behavior so numbers update immediately on click.

### 4) Show customer image/file attachments in conversations and tickets
- Update conversation/ticket message queries to include `attachments` JSON.
- Map attachment metadata (`url`, `name`, `size`, `content_type`, `storage_path`) into the dashboard `Message` model.
- Pass full attachment metadata into `AttachmentBubble` instead of only `fileName`, so real uploaded images render instead of blank/demo previews.
- If widget message persistence is missing attachment fields, update `chat-ai` persistence to store the customer attachment URL/data metadata in `conversations_messages.attachments`, `kind`, and `file_name`.

### 5) Empty team list message
- When the team member query succeeds and returns zero rows, show the Arabic message `لا يوجد أعضاء` (and English fallback `No members`) instead of an empty table body.

## Technical files likely affected
- `widget/src/app/components/ChatWidget.tsx`
- `widget/src/app/utils/analytics.ts` if rating/close retry needs adjustment
- `src/app/components/ConversationsPage.tsx`
- `src/app/components/TicketsPage.tsx`
- `src/app/components/Layout.tsx`
- `src/app/context/AppContext.tsx`
- `src/app/utils/permissions.ts`
- `src/app/components/RequirePermission.tsx`
- `src/app/components/TeamPage.tsx`
- `supabase/functions/chat-ai/index.ts` if attachments are not being stored
- Possible Supabase migration for status-aware `member_can` and clean delete/deactivate behavior