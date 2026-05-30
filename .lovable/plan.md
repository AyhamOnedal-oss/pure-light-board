## Goal

Fix the "نعم" customer-service escalation loop directly in your real production widget (the 151KB IIFE), and give you a downloadable `widget-4.7.7.js` you can upload to Hostinger.

## File clarification

- **Hostinger 4.7.6** = your live widget = same as `/mnt/documents/widget.js` (151KB hand-written IIFE).
- **`/mnt/documents/widget.js`** = the file I will patch. Output → `/mnt/documents/widget-4.7.7.js`.
- **`widget/dist/widget.js`** = unrelated React/Vite bundle (428KB). Not deployed anywhere. Will be ignored from now on.

## Steps (build mode)

1. Read `/mnt/documents/widget.js` (the 4.7.6 IIFE) end-to-end and locate `pushAiMessage`, `doSend`, `handleInlineTicketSubmit`.
2. Bump header to `Version: 4.7.7 (fix: customer-service escalation loop)`.
3. Add helpers near the top of the IIFE:
   - `normalizeAr(text)` — strip tashkeel, normalize alef/yeh/teh-marbuta, lowercase.
   - `isTicketOfferText(text)` — matches "يتواصل معك أحد موظفي خدمة العملاء", "اكلم خدمة العملاء", etc.
   - `isShortAffirmative(text)` — matches نعم / ايوه / تمام / اكيد / yes / ok.
4. Patch `pushAiMessage`: if the assistant text is a ticket-offer AND `state.ticketCreated` is false AND no open `ticket-form` already exists, append an inline `ticket-form` bubble right after the text bubble.
5. Patch `doSend`: before calling `sendToBackend`, if the last store message is a ticket offer AND the user's message is a short affirmative AND no open `ticket-form` exists, push a local `ticket-form` message (`state.ticketSource='inline'`), stop typing, re-render, and `return` — do **not** call the backend.
6. Leave `handleInlineTicketSubmit`, `restCreateTicket`, ticket-created screen, styling, and config untouched.
7. Write the patched file to `/mnt/documents/widget-4.7.7.js` and also overwrite `/mnt/documents/widget.js` so it stays the latest source of truth.
8. Add a short `/mnt/documents/widget-v4.7.7-notes.md` matching your existing notes format.

## Deliverable

A `<presentation-artifact>` link to `widget-4.7.7.js` in OTHER, just like the previous versions. You download it and upload to Hostinger, then purge the CDN cache for `widget.fuqah.net/widget.js` (current `max-age=604800`).

## Out of scope

- No changes to `widget/` React source, edge functions, or backend.
- No upload to Hostinger (no credentials here — manual step on your side).
