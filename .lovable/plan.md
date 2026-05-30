## Problem

When the AI asks "هل تحتاج مساعدة إضافية؟" and the user replies "لا", the bot replies again with another closing question ("تمام 👍 إذا احتجت شي... هل تحتاج مساعدة إضافية؟") instead of ending the conversation. This creates a soft loop and never triggers the rating screen.

## Fix (widget 4.7.8 — patch the real `/mnt/documents/widget.js`)

1. Bump header to `Version: 4.7.8 (fix: smart end on "لا" after close offer)`.

2. Add helpers next to the existing `isShortAffirmative` / `isTicketOfferText`:
   - `isShortNegative(text)` — matches `لا / لأ / لا شكرا / مشكور / تمام شكرا / no / nope / nothing`.
   - `isCloseOfferText(text)` — matches "هل تحتاج اي مساعده اخرى/أخرى/إضافية", "do you need any other help".

3. Patch `doSend` (before calling `sendToBackend`):
   - Find the last `store` message.
   - If it is a close-offer AND user's text is a short negative AND no open `ticket-form` exists:
     - Push one short farewell AI bubble: `"شكراً لتواصلك معنا 🌷 يومك سعيد."` (no further question, no quick replies).
     - Mark conversation as ended (`state.conversationEnded = true`), stop typing, re-render.
     - After ~600 ms open the existing rating screen (same path used by the X → "إنهاء المحادثة" flow).
     - `return` — do NOT call the backend, so the model can't generate another loop reply.

4. Patch `pushAiMessage` close-offer pass: keep the quick replies, but if `state.conversationEnded` is already true, suppress any further close-offer bubbles coming back from the backend.

5. Leave ticket flow (4.7.7), inline form, styling, and config untouched.

6. Write to `/mnt/documents/widget-4.7.8.js`, overwrite `/mnt/documents/widget.js`, add `/mnt/documents/widget-v4.7.8-notes.md`.

## Deliverable

A `<presentation-artifact>` link to `widget-4.7.8.js` (OTHER). Upload to Hostinger as `widget.js` and purge the CDN cache for `widget.fuqah.net/widget.js`.

## Out of scope

- No backend / edge function / n8n prompt changes.
- No changes to the `widget/` React source.
