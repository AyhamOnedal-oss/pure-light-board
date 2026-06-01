## Problem

When a ticket is created (either via inline phone form from `offer_ticket` intent, or via the "رفع تذكرة" modal form), the Hostinger widget currently:
- Pushes a "تم استلام رقمك ✅..." chat bubble
- After 5s (inline) or 0s (form), calls `endConversationNoRating()` which just disables the textarea

It never opens the existing `renderTicketCreatedScreen()` panel (image 2: ticket number `#TKT-…`, status "مفتوحة", "خلال 24 ساعة", "تحميل التذكرة" button). That screen already exists in the bundle but is unreachable in v4.7.16.

## Fix (widget only — `/mnt/documents/widget-4.7.16-hostinger.js`, mirrored to `widget.js`)

1. **Persist server ticket number.** In both ticket-success callbacks (`handleInlineTicketSubmit` and `renderCreateTicketScreen`'s submit), set:
   ```
   state.ticketId = '#' + (row.display_code || ('TKT-' + row.number));
   ```
   instead of leaving the random local id.

2. **Route to the ticket screen after success.**
   - `handleInlineTicketSubmit` success path: keep the inline "تم استلام رقمك ✅" confirmation bubble in the transcript, then after ~1.2s call `renderTicketCreatedScreen()` instead of `endConversationNoRating()`. Drop the 5s timeout.
   - `renderCreateTicketScreen` submit success path: call `renderTicketCreatedScreen()` directly (no chat bubble, no `renderChatScreen()`).

3. **Stop auto-closing the ticket screen.** Remove the `setTimeout(...3500ms → endConversationNoRating)` inside `renderTicketCreatedScreen()`. The screen stays until the user taps the close/X. End the conversation (disable input) only when they leave the screen via the close button — change those handlers to call `endConversationNoRating()` then `closeChat()`, and remove the auto-timeout.

4. **`closed` intent still works.** When backend returns `intent: "closed"` and `state.ticketCreated === true`, keep current behaviour: switch to `renderTicketCreatedScreen()` (so the user sees the ticket card on the way out) instead of just disabling input.

5. **Bump build comment** to note "v4.7.16 — ticket-created screen shown after ticket success". No version number change (still 4.7.16).

6. Overwrite `/mnt/documents/widget.js` with the updated bundle.

## Out of scope
- `chat-ai` edge function (already correct).
- React widget under `widget/` (already has `TicketCreatedScreen.tsx`).
- n8n / DB / styles.

## Files changed
- `/mnt/documents/widget-4.7.16-hostinger.js`
- `/mnt/documents/widget.js`
