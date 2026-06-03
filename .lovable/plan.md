# Plan: forward image attachments from the widget to `chat-ai` (ship v4.7.24)

## Why the agent doesn't "see" the image in the store

In the live widget (`widget-4.7.23-hostinger.js`), `sendToBackend(text, callback)` at line 2651 sends only `{ message, history, ... }` to `/chat-ai`. It **never includes `attachments`**.

The dashboard's TestChat works because it converts the image to a base64 data URL and posts `{ attachments: [{url, content_type, ...}] }`. The `chat-ai` edge function only runs the OpenAI vision pre-processing when `body.attachments` is a non-empty array (`supabase/functions/chat-ai/index.ts` line 267, 287). So the camera photo reaches OpenAI in the test chat, but in the store the AI just sees the text "المنتج متوفر؟" with no image context — that's why it asks "أي منتج تقصد؟".

A second issue: the widget stores `attachment.url` as a `blob:` URL (from `URL.createObjectURL`). `blob:` URLs are only readable inside the browser tab that created them, so the edge function couldn't fetch them anyway. They must be sent as **base64 data URLs**, which is what OpenAI vision expects with `detail: "low"`.

## Changes (in `widget-4.7.23-hostinger.js`, save as `widget-4.7.24-hostinger.js`)

1. **Compute a data URL during image selection.**  
   In `fileInput.onchange` and the `compressImage` callback (lines ~1305–1330), after we have the final blob, read it through `FileReader.readAsDataURL` and store on the attachment: `state.attachment.dataUrl = "data:image/jpeg;base64,..."`. For non-image files, leave `dataUrl` undefined (chat-ai will ignore them — vision only runs on images).

2. **Pass the attachment to `sendToBackend`.**  
   - In `doSend` (~line 1419), call `sendToBackend(text, att, callback)` instead of `sendToBackend(text, callback)`.
   - Change `sendToBackend(text, callback)` → `sendToBackend(text, attachment, callback)`.
   - When `attachment && attachment.dataUrl`, include in the POST body:  
     `attachments: [{ url: attachment.dataUrl, name: attachment.name, content_type: 'image/jpeg', size: attachment.size }]`.  
   - Otherwise omit the field (current behavior).

3. **Version bump.** Bump the two `console.log('[Fuqah] Widget v4.7.23 …')` strings to `v4.7.24`. Add a `// v4.7.24 — forward image attachments to chat-ai for vision` comment near `sendToBackend`.

4. **No edge-function changes.** `chat-ai` already handles the attachment + vision flow (verified at lines 267–356). The plan from the earlier turn (~$0.0006 per image with gpt-4o-mini `detail: "low"`) still applies — cost unchanged.

## Deliverable

`widget-4.7.24-hostinger.js` in `/mnt/documents/`. Upload to Hostinger. After deploy: send a product photo in the live widget; expect the AI to reply with a vision-aware answer (and `vision_usage` log entry in edge-function logs).
