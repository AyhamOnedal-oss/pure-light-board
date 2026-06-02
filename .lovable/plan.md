## Goal
Fix two terminal-flow bugs in `/mnt/documents/widget-4.7.20-hostinger.js`.

## Bug 1 — X close modal skips the rating screen
**Where:** line 1726, the "إغلاق المحادثة" button inside the close-confirmation modal.
**Now:** `onclick = ... endConversationNoRating();` → instantly marks the conversation ended, so the chat screen shows "تم انتهاء المحادثة" with no rating UI.
**Fix:** route the button to the rating screen, exactly like every other normal end:
```js
closeChat_.onclick = function () {
  overlay.remove(); dom.modalOverlay = null;
  renderRatingScreen();
};
```
Rating screen behavior is unchanged: submit / skip / 15-min auto-close already call `fullClose()` and persist `status='closed'` with the right `close_reason`. The "سأعود للمحادثة" and "رفع تذكرة" buttons in the same modal stay untouched.

## Bug 2 — After ticket "شكراً لك", reopening still shows the ticket-created screen
**Where:** lines 2189–2196 (ticket-created primary button) + `fullClose()` at line 2267.
**Root cause:** the button correctly calls `endConversationNoRating('user_ticket_acknowledged'); fullClose();`, and `fullClose()` resets `messages`, `currentScreen='chat'`, `ticketCreated=false`, new `conversationId`/`ticketId` — **but it never resets `state.conversationEnded`**. So on the next `openChat()`, `renderChatScreen()` hits the `if (state.conversationEnded) { ... }` branch (line 1603) and the user sees an "ended" state instead of a brand-new chat. Some other transient flags (`ticketSource`, idle prompt flags, rating fields) also leak across sessions.
**Fix:** extend `fullClose()` to fully reset every per-conversation flag so reopening is guaranteed to be a clean slate:
```js
state.conversationEnded = false;
state.ticketSource = null;
state.rating = 0;
state.feedback = '';
state.inactivityPromptShown = false;
// (plus any other idle/rating transient flags already in `state`)
```
Place these resets next to the existing resets at lines 2270–2274 in `fullClose()`. No change to the back-arrow on the ticket-created screen — it still calls `renderChatScreen()` so the user can keep chatting as long as they haven't pressed "شكراً لك".

## Verification path (after build)
1. Open chat → press X → tap "إغلاق المحادثة" → rating screen appears (not "تم انتهاء").
2. Submit/skip rating → widget closes → reopen → brand-new empty chat with new `conversationId`.
3. Raise ticket → "حسناً شكراً لك" → widget closes → reopen → brand-new empty chat (no ticket-created screen, no ticket number).
4. Raise ticket → press the back arrow (don't press شكراً) → still inside the same conversation, can keep chatting.

## Out of scope
- AI auto-detect close path (`end_conversation` intent) — untouched.
- `endConversationNoRating()` and `restCloseConversation()` DB-sync logic — untouched.
- Rating UI, idle 3-stage logic, n8n, dashboard — untouched.

## Files touched
- `/mnt/documents/widget-4.7.20-hostinger.js` (two small edits: line 1726 handler, and added state resets in `fullClose()` around line 2270). Version header bumped to note: "X→rating fix, ticket-thanks full state reset".
