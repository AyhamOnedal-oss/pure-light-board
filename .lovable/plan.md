## Goal
Fix two flow issues without ever showing a star rating again, and simplify close-detection.

## Changes

### 1. `widget-4.7.14-hostinger.js` → bump to `widget-4.7.15-hostinger.js`

**a. Kill the rating screen entirely**
- Remove/short-circuit the function that renders the star rating (`showRating` / equivalent).
- After ticket creation: just keep the ticket-number card visible (with its existing print/copy actions) and disable the input with a small "تم إنهاء المحادثة" footer. No rating, no auto-close, no stars.
- After a normal conversation close (no ticket): same thing — show a simple "تم إنهاء المحادثة — شكراً لتواصلك معنا" end-state, disable input. No stars.

**b. Simplify close detection (remove conflict with backend)**
- Stop reading `action.type === "offer_close_done"` from the chat-ai response on the widget side. Ignore that field for ending the conversation.
- Keep only two client-side triggers:
  1. **User short-negative reply** to a "هل تحتاج مساعدة أخرى؟" offer — detect Arabic/English negatives (`لا`, `لا شكراً`, `كفاية`, `خلاص`, `no`, `nope`, `that's all`, etc.) when the previous AI message was a close-offer (`isCloseOfferText`). → end immediately.
  2. **AI farewell text** — `isCloseDoneReply()` matches `شكراً لتواصلك معنا`, `يومك سعيد`, `في أمان الله`, `سعدنا بخدمتك`, `نتمنى لك يوماً سعيداً`, English equivalents. → end after **2s** delay.
- Both paths call the same `endConversation()` helper which:
  - Sets `state.conversationEnded = true`
  - Disables the composer
  - Appends the end-state footer
  - **Does NOT** call rating UI
- Guard: if `state.ticketCreated === true`, skip the farewell-detection auto-end (ticket card already ended the convo).

**c. File output**
- Save as `/mnt/documents/widget-4.7.15-hostinger.js` AND overwrite `/mnt/documents/widget.js` with the same bytes.
- Verify size stays ~155 KB (Hostinger bundle, not the 400 KB React bundle).

### 2. `supabase/functions/chat-ai/index.ts`
- Leave the classifier as-is; the widget will simply ignore `offer_close_done` going forward. No redeploy needed for this change unless you want me to also strip the action from the response — I'll leave it untouched to avoid breaking anything else.

## Out of scope
- No changes to ticket creation logic, classifier prompt, or backend models.
- No changes to the React preview widget (only the Hostinger bundle the user actually ships).

## Deliverable
A new `widget-4.7.15-hostinger.js` (~155 KB) replacing `widget.js`, ready to upload to widget.fuqah.net.
