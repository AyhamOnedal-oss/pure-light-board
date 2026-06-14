I found the mismatch: `widget-4.7.26-hostinger.js` and `widget-4.7.27-hostinger.js` currently start with the minified `(function(){try{...` bundle, not the Hostinger paste file format you need.

Plan:
1. Use the latest unminified Hostinger-format file as the base: `/mnt/documents/widget-4.7.25-hostinger.js` / `/mnt/documents/widget-4.7.23-hostinger.js`, which starts with:
   ```js
   /**
    * Fuqah AI Chat Widget — Embeddable Script
   ```
2. Apply the previous fixes to that unminified Hostinger-format file:
   - remove the duplicate red ticket-offer message and keep only the green message
   - remove the top-right/back arrow after a ticket is raised
   - ensure tickets do not use the idle timer
   - adjust desktop chat window positioning so it sits against the bottom bar and does not hide the top of the chat
3. Save the result as a new downloadable/pasteable file in `/mnt/documents`, for example:
   - `widget-4.7.28-hostinger.js`
4. Verify before handing it over:
   - file starts with the exact `/** Fuqah AI Chat Widget — Embeddable Script` header
   - file size is around the expected 160–170KB range, not the 450KB minified app bundle
   - the old minified `(function(){try{var s=document.createElement("style")...` format is not used
   - all requested ticket/chat fixes are present