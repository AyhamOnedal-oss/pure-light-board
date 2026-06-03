## AHA moment

The logs confirm the latest store message reached `chat-ai` with **`attachments: []`** and no `vision_usage` log. So OpenAI Vision never ran.

There are actually two active widget paths:

1. The downloadable Hostinger bundle `/mnt/documents/widget-4.7.24-hostinger.js` was patched.
2. The live store is using the iframe app path from `widget-loader`: `APP_BASE_URL + "/widget/chat?..."`, which uses `widget/src/app/*`.

That React iframe path still drops attachments:
- `ChatInput.tsx` creates only a preview `blob:` URL, not a base64 `dataUrl`.
- `ChatWidget.tsx` calls `sendMessage(conversationId, text, history)` without the attachment.
- `chatApi.ts` posts no `attachments` field to `/chat-ai`.

So the patched Hostinger file is not the path currently producing the screenshot/logs.

## Plan

1. Update the active React widget attachment model
   - Add `dataUrl?: string` and `content_type?: string` to `MessageAttachment`.
   - Keep `url` as the local preview URL for UI rendering.

2. Convert selected images to base64 in `ChatInput.tsx`
   - For small images: read the original `File` as a data URL.
   - For compressed images: read the final compressed blob as a data URL.
   - Disable send until the image data URL is ready, same as compression.
   - Preserve existing non-image attachment behavior.

3. Forward attachments from `ChatWidget.tsx` to `chatApi.ts`
   - Change `sendMessage(...)` to accept the optional attachment.
   - Pass the selected image attachment into the API call.
   - Remove/adjust the “attachment-only no AI call” early return so image-only sends can also trigger vision.

4. Include image attachments in the `/chat-ai` request body
   - If `attachment.type === 'image'` and `attachment.dataUrl` exists, send:
     ```json
     {
       "attachments": [
         {
           "url": "data:image/...;base64,...",
           "name": "...",
           "content_type": "image/jpeg|image/png|image/webp|image/gif",
           "size": 12345
         }
       ]
     }
     ```
   - Otherwise omit `attachments`.

5. Add backend debug visibility
   - Add a concise `chat-ai attachments_in` log with count and content types before vision.
   - This makes future failures obvious immediately: no attachment vs. vision failure.

6. Validate
   - Query recent `conversations_messages` to confirm new customer messages persist non-empty `attachments`.
   - Check `chat-ai` edge logs for `attachments_in` and `vision_usage` after the next test.

## Expected result

After this, the same storefront test should show non-empty `attachments` in the DB/logs, `vision_usage` in `chat-ai`, and the AI should receive injected image description text before it calls n8n.