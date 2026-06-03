# Fix "فشل رفع الملف" in Test Chat

## Root cause
The Test Chat upload calls `supabase.storage.from('chat-attachments').upload(...)`, but the `chat-attachments` bucket does not exist in Supabase Storage. The earlier migration that would have created it was never run, so every upload fails immediately and the UI shows the generic "فشل رفع الملف" error.

I confirmed this by querying `storage.buckets` — no row for `chat-attachments`.

## Fix
Run a single migration that:

1. Creates a **private** `chat-attachments` bucket
   - `file_size_limit`: 5 MB
   - `allowed_mime_types`: `image/jpeg, image/png, image/webp, image/gif`
2. Adds RLS policies on `storage.objects` scoped to that bucket so only tenant members can read/write their tenant's folder:
   - Path convention: `<tenant_id>/...` (matches what TestChat.tsx already uses)
   - INSERT: `is_tenant_member(folder[1]::uuid, auth.uid())`
   - SELECT: same check (needed for `createSignedUrl`)
   - DELETE: same check
3. The edge function `chat-ai` uses the service role, so it can already read uploaded files to mint signed URLs for n8n — no extra policy needed for it.

## After migration runs
- Retry uploading an image in **اختبار المحادثة** — it should upload, render as a thumbnail in the bubble, and the signed URL gets forwarded to n8n.
- Once verified end-to-end with the n8n multimodal expression, we replicate the same UI (Paperclip + previews + upload) into `widget/src/app/components/ChatInput.tsx` and pass `attachments` through `widget/src/app/utils/chatApi.ts` to `chat-ai`.

## Note
No frontend code changes are needed for this fix — TestChat.tsx is already wired correctly. The only missing piece is the bucket itself.
