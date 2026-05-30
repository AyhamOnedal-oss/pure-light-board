## Problem

`chat-ai` is correctly returning `action.type = "offer_ticket"` (confirmed in edge function logs), but the live widget uses `ChatWindow.tsx`, not `ChatWidget.tsx`. `ChatWindow.tsx` ignores `result.action`, so every reply is rendered as plain text. When the customer answers "اي نعم", it's sent back to the AI, which classifies it again as `offer_ticket` and the same "هل ترغب أن يتواصل معك أحد موظفي خدمة العملاء؟" string loops — the phone form never appears.

`ChatWidget.tsx` already has the correct logic but it isn't the component mounted in production.

## Fix

Port the `action` handling from `ChatWidget.tsx` into `ChatWindow.tsx`.

1. In `handleSendMessage` (ChatWindow.tsx), after `sendBackendMessage` returns:
   - If `result.action?.type === "offer_ticket"`: append the AI text bubble, then append a second message with `type: 'ticket-form'` so `ChatInlineTicketForm` renders directly under the bubble. Set `ticketSourceRef.current = 'inline'` and fire `trackEvent('ticket.form_shown', evCtx, { source: 'inline' })`. If `ticketCreated` is already true, append the "تم إنشاء تذكرة مسبقاً" success message instead.
   - If `result.action?.type === "offer_close"`: append the AI text bubble with `quickReplies: [{label:'نعم',value:'yes'},{label:'لا',value:'no'}]`.

2. Add `handleQuickReplyPick(messageId, value)`:
   - Mark that message `quickReplyPicked: true`.
   - `no` → `setCurrentScreen('rating')` (and fire `closeConversation(evCtx, 'manual')`).
   - `yes` → call `handleSendMessage('نعم')`.

3. Pass `onQuickReplyPick={handleQuickReplyPick}` to `<ChatMessage>` in the render loop. `ChatMessage` and `QuickReplies` already support this.

4. Safety guard against the loop: in `handleSendMessage`, before calling the backend, if the last assistant message has `action === 'offer_ticket'` and the user's text is a short affirmative (نعم / اي / ايوه / تمام / yes / ok), skip the backend call and just append the inline `ticket-form` message locally.

## Files changed

- `widget/src/app/components/ChatWindow.tsx` (only file).
- Optionally tighten `Message.action` typing if needed — already declared in `ChatWidget.tsx`.

No backend or edge function changes — `chat-ai` is already returning the correct flag.

## Validation

1. Type "احكي مع موظف" → AI bubble "هل ترغب أن يتواصل معك أحد موظفي خدمة العملاء؟" appears, immediately followed by the phone+country inline form.
2. Submitting the phone creates a ticket and shows the ticket-created screen (existing `handleInlineTicketSubmit` path).
3. If the user instead types "اي نعم", the phone form opens locally (no AI loop).
4. Saying "شكراً" → AI bubble + نعم/لا chips; tapping لا opens the rating screen.
5. Normal Q&A turns unchanged.