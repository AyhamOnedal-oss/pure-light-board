## Goal
Figure out why the Salla n8n workflow doesn't see the merchant prompt, while Zid does.

## What I already verified
- `supabase/functions/chat-ai/index.ts` builds the n8n payload symmetrically for both platforms — there is no Salla-specific branch that strips `ai.prompt`. Both platforms get:
  ```
  ai: { mode, prompt: mode==='file' ? null : prompt, file_url: ... }
  ```
  loaded from `settings_train_ai` by `tenant_id`.
- The Zid workflow (`docs/n8n/fuqah-zid-workflow-v3.json`) reads `$('Webhook').item.json.body.ai.prompt` in its system message. If the Salla workflow (`get_conversation2`) was built differently, it may simply not reference that field.

So the prompt is either (a) empty in the DB for the Salla tenant, or (b) the Salla n8n workflow doesn't bind `body.ai.prompt` into its AI Agent system message.

## Plan

1. **Add a non-sensitive prompt-presence log in `chat-ai`** (right next to the existing `n8n route` log), to confirm what the edge function actually sent on each request:
   ```text
   n8n ai_payload mode= prompt prompt_len= 1843 file_url= null
   ```
   No prompt content, just length + mode. This tells us instantly whether the payload is the problem or the n8n workflow is.

2. **Redeploy `chat-ai`** so the new log is live.

3. **User sends one Salla test message**, then we read the logs:
   - If `prompt_len= 0` (or `mode= file`) → the Salla tenant's `settings_train_ai.prompt` is empty / mode is wrong. Fix in the dashboard Train AI screen for that tenant.
   - If `prompt_len > 0` → the payload is correct. The issue is the Salla n8n workflow (`get_conversation2`) doesn't reference `{{ $('Webhook').item.json.body.ai.prompt }}` in its AI Agent system message. Fix by editing the Salla workflow's System Message node to match the Zid workflow (see `docs/n8n-integration.md` §2 and `docs/n8n/fuqah-zid-workflow-v3.json` for the exact expression).

## Scope
Only `supabase/functions/chat-ai/index.ts` is edited (add one log line). No DB, widget, or behavior changes.
