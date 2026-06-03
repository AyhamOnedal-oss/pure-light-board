
# Image Attachments with Vision — Test Chat → Widget

Goal: let users attach an image in اختبار المحادثة, have the n8n AI Agent (gpt-4o-mini) describe/answer about it, count usage, then port the same flow to `widget.js v22`.

Decisions confirmed:
- Vision runs in **n8n** (gpt-4o-mini), not in the edge function.
- File flow: **Supabase Storage** private bucket + signed URL.
- Accepted types: **images only** — `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Max 5 MB.
- Usage: **+750 words flat per image** (in addition to AI reply words already counted).

---

## 1. Storage — new private bucket `chat-attachments`

Created via `supabase--storage_create_bucket` (private, 5 MB limit, image MIME whitelist). Path convention:

```
{tenant_id}/{conversation_id}/{uuid}.{ext}
```

RLS on `storage.objects`:
- `INSERT` allowed to `authenticated` when path's first folder = a tenant the user belongs to (`is_tenant_member`).
- `INSERT` allowed to `anon` ONLY for paths under `{tenant_id}/test-*/` (so the widget can upload too, scoped to test-conversation prefix later; for now widget upload is out of scope until v22).
- `SELECT` to `service_role` only — n8n fetches via signed URL, never directly.
- No public read.

Edge function generates a 1-hour signed URL after upload.

## 2. DB — track attachments

Add to `conversations_messages`:
- `attachments jsonb NOT NULL DEFAULT '[]'::jsonb` — array of `{ url, name, content_type, size, storage_path }`.

Extend `bump_word_usage` trigger: if `NEW.sender = 'customer'` and `jsonb_array_length(NEW.attachments) > 0`, add `750 * count` to the same `monthly_words_used` / `ai_words_used` updates. Surcharge logged on the customer message so usage is captured even if AI reply fails.

## 3. Edge function `chat-ai` — accept attachments

New optional field in request body:
```ts
attachments?: Array<{ url: string; name: string; content_type: string; size: number; storage_path: string }>
```

Behavior:
- Validate: max 4 images per message, each ≤5 MB, content_type in whitelist.
- Persist to `conversations_messages.attachments` on the customer-message insert (trigger then bills the surcharge).
- Forward to n8n in the existing payload, untouched:
  ```json
  { "message": "...", "attachments": [{ "url": "https://...signed", "content_type": "image/png" }], ... }
  ```
- Rate limit + `is_test` short-circuit unchanged.

No new secrets. Same `N8N_WEBHOOK_URL`.

## 4. n8n workflow change (you do this in n8n, one-time)

In the existing AI Agent node, switch the **OpenAI Chat Model** to `gpt-4o-mini` and set the **User Message** to a multimodal expression:

```
={{
  $json.attachments && $json.attachments.length
    ? [
        { type: 'text', text: $json.message || 'Describe the attached image.' },
        ...$json.attachments.map(a => ({ type: 'image_url', image_url: { url: a.url, detail: 'high' } }))
      ]
    : $json.message
}}
```

That is the only n8n edit. Respond-to-Webhook shape stays `{ "reply": $json.output }`.

I'll update `docs/n8n-integration.md` with the new payload field and the User Message expression.

## 5. Test Chat UI (`src/app/components/settings/TestChat.tsx`)

- Wire the existing 📎 paperclip to actually upload via `supabase.storage.from('chat-attachments').upload(...)` to path `{tenantId}/test-{conversationId}/{uuid}.{ext}`.
- Show inline preview thumbnail in the user bubble (max 200px).
- On send: create signed URL (1 h), call `chat-ai` with `attachments: [...]` plus optional caption text.
- Validation: client-side type + size check, friendly Arabic/English error toast.
- Loading state: thumbnail with shimmer until upload finishes; send button disabled.
- Errors: failed upload → red bubble with retry; oversize → toast.

Keep `is_test: true`, so usage (including the 750-word surcharge) deducts from quota and the row stays hidden from Conversations.

## 6. Verification before porting to widget

1. Upload a JPG in Test Chat → see thumbnail, see AI describe it correctly.
2. Check `conversations_messages.attachments` row populated.
3. Check `settings_plans.monthly_words_used` jumped by `750 + AI-reply word count`.
4. Confirm row is hidden from Conversations page (because `is_test=true`).
5. Try oversized file, wrong type, network failure — confirm graceful errors.
6. Hit per-tenant rate by spamming 6 images — confirm 4-image cap.

## 7. Widget v22 port (separate follow-up commit)

Mirror the Test Chat flow in `widget/src/app/components/ChatInput.tsx` + `widget/src/app/utils/chatApi.ts`:
- Upload to `chat-attachments` under `{tenant_id}/{conversation_id}/{uuid}.{ext}` (real conv id, not test prefix).
- Add `attachments` to `sendMessage` payload.
- Anonymous-user upload requires loosening the `anon` storage policy to `INSERT` into `{tenant_id}/...` (scoped to known tenant). Will add when we cut v22.
- Bump widget bundle version → 22, update `widget-loader` cache-busting.

Widget changes are NOT in this PR — only Test Chat + backend.

---

## Technical details (for me to execute in build mode)

Migration (single file):
- `ALTER TABLE conversations_messages ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`
- Replace `bump_word_usage` to add `750 * jsonb_array_length(NEW.attachments)` words on customer rows.
- Storage policies on `storage.objects` for `chat-attachments` (authenticated insert/select scoped via `is_tenant_member`, service_role full).

Storage bucket: `supabase--storage_create_bucket(name="chat-attachments", public=false)` + `file_size_limit=5242880`, `allowed_mime_types=['image/jpeg','image/png','image/webp','image/gif']`.

Edge function: validate, persist `attachments`, generate signed URL just before sending to n8n (so URL stays valid; bucket is private), forward.

TestChat: extract paperclip handler into upload+preview+send pipeline. Reuse existing pending/error message states for upload errors.

Types: regenerate `src/integrations/supabase/types.ts` after migration.

## Files touched

- `supabase/migrations/<new>.sql` (new)
- `supabase/functions/chat-ai/index.ts`
- `src/app/components/settings/TestChat.tsx`
- `docs/n8n-integration.md`
- `src/integrations/supabase/types.ts` (regenerated)

Widget files come in the v22 PR, not this one.
