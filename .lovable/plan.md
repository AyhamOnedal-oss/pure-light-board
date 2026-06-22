## Goal
Make sending an image + text in chat always return a real AI reply instead of "عذراً، حدث خطأ مؤقت".

## Root cause
The widget sends the attached image to `chat-ai` as a base64 `data:image/...` URL. `chat-ai`:
1. Uses it directly for an internal OpenAI vision pre-analysis (works).
2. Forwards the **same `data:` URL** to n8n in `attachments[].url`.

The n8n workflow's OpenAI / HTTP nodes cannot fetch a `data:` URL — the docs explicitly state n8n receives "1-hour signed URLs to a private Supabase Storage bucket". n8n then errors out or returns an empty reply, and the widget falls back to the generic "temporary error" string. Same path for Test Chat. There are also no detailed logs around the n8n response, so the failure mode is invisible today.

## Changes

### 1. Upload attachments to Supabase Storage inside `chat-ai`
- Create a private bucket `chat-attachments` (via storage tool) with RLS that only the service role writes.
- In `supabase/functions/chat-ai/index.ts`, after validating `attachmentsIn`, for any attachment whose `url` starts with `data:`:
  - Decode base64, upload to `chat-attachments/{tenant_id}/{conversation_id}/{uuid}.{ext}`.
  - Generate a 1-hour signed URL.
  - Replace the entry's `url` with the signed URL and remember the original data URL only for the internal vision call.
- Keep `http(s)://` URLs untouched.
- Continue passing the data URL (or the signed URL) to the OpenAI vision pre-processing — vision keeps working as today.

### 2. Forward only the signed URL to n8n
- The n8n payload `attachments[].url` will now always be a real fetchable HTTPS URL, matching `docs/n8n-integration.md`.
- No widget changes required.

### 3. Hard fallback when n8n returns empty / bad reply with an attachment
- After the n8n call, if `reply` is empty (or `n8nRes` not ok), and vision produced a useful description/product guess, return a friendly Arabic reply built from the vision verdict (e.g. "وصلتني صورة لما يبدو أنه {productGuess} — هل هذا المنتج الذي تبحث عنه؟") instead of leaving `reply` empty.
- This guarantees the widget never shows "عذراً، حدث خطأ مؤقت" for an image message.

### 4. Better diagnostics
- Log `n8n_response` with `status`, `reply_length`, and a 300-char body excerpt on both ok and non-ok paths so future regressions are visible in the edge-function logs.

## Out of scope
- No changes to widget UI/UX, image compression, or vision prompt logic.
- No change to the Salla/Zid default-prompt work or KPI animation from prior turns.

## Verification
- Send an iPhone image + "هل عندكم هذا المنتج؟" in Test Chat → expect a real product-aware reply.
- Repeat from the storefront widget (Salla and Zid) → same.
- Send an image-only message → still works.
- Check `chat-ai` edge logs for the new `n8n_response` line and a signed `chat-attachments` URL in the payload.
