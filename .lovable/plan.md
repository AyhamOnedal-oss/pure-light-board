## Plan

1. **Redeploy `chat-ai`** to force fresh edge runtime instances that pick up the latest `N8N_WEBHOOK_URL_SALLA` value.
   - Supabase usually re-reads env on cold start, but warm instances can hold the old secret value until they recycle. A redeploy guarantees a clean read.

2. **Add a non-sensitive route fingerprint log** to `supabase/functions/chat-ai/index.ts` (next to the existing `n8n webhook platform=` line) so we can prove which secret was picked and which n8n path it points at — without exposing the URL:

```text
n8n route secret= N8N_WEBHOOK_URL_SALLA path= /webhook/get_conversation2
```

3. **Send one Salla test message** and read `chat-ai` logs.
   - If `path= /webhook/get_conversation2` → routing is correct; any remaining issue is inside the n8n Salla workflow.
   - If `path= /webhook/get_conversation1` → `N8N_WEBHOOK_URL_SALLA` still holds the Zid URL; update the secret.
   - If `secret= N8N_WEBHOOK_URL` (fallback) → the Salla secret is effectively empty; re-save it.

## Scope

- Edit only `supabase/functions/chat-ai/index.ts` (add one diagnostic log line).
- No widget changes, no DB changes, no behavior changes.