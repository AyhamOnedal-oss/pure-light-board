## Plan

1. **Patch the real widget entry path**
   - Treat `widget/src/app/components/ChatWidget.tsx` as the source for the standalone `widget.js` bundle.
   - Add the same escalation fallback there: if the AI reply text is the customer-service offer, render the inline phone form immediately even when `action.type` is missing.
   - Add a local affirmative guard so if the user types “نعم” after that prompt, the widget opens the phone form locally and does not call `chat-ai` again.

2. **Keep `ChatWindow.tsx` aligned**
   - Keep the existing fix in the iframe/dashboard widget path so both runtime paths behave the same.
   - Change the manual `triggerAutoTicket` helper to open the phone form, not the ticket-created screen.

3. **Generate/update the actual bundle**
   - Run the widget build so `widget/dist/widget.js` is generated from the patched source.
   - Confirm the built bundle contains the fallback strings and phone-form text.

4. **Document deployment requirement**
   - The hosted `https://widget.fuqah.net/widget.js` is cached for 7 days right now, so code changes in the repo will not affect the store until the new `widget/dist/widget.js` is uploaded or the CDN cache is purged.
   - I’ll update the widget docs or notes to make that explicit if needed.

## Technical details

- The screenshot behavior strongly suggests the live `widget.js` bundle does not include the current React-source fix or is serving a cached older bundle.
- The hosted bundle currently returns `Cache-Control: public, max-age=604800`, so we should build the corrected bundle and then deploy/purge it.
- No backend schema changes are needed.