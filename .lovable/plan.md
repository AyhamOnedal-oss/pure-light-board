## Diagnosis

The `chat-ai` edge function code is already correct:

- `pickN8nUrl("salla")` returns `N8N_WEBHOOK_URL_SALLA`
- `pickN8nUrl("zid")` returns `N8N_WEBHOOK_URL_ZID`
- Log line confirms it: `n8n webhook platform= salla kind= PRODUCTION`

You confirmed the two n8n workflows have **different** Production URLs. So the request really did go to whatever URL is stored in the `N8N_WEBHOOK_URL_SALLA` secret — and that URL is the Zid workflow's URL, not the Salla one.

In short: the routing logic isn't broken. The secret value is wrong.

## Plan

1. **Update the secret `N8N_WEBHOOK_URL_SALLA`** to the Salla workflow's Production webhook URL (the one you confirmed is different from Zid's). I'll trigger the secure secret-update form for you.
2. **(Optional) Re-verify `N8N_WEBHOOK_URL_ZID`** at the same time so both are known-good.
3. **Test from a Salla store** — send a message, then check the n8n executions list. The Salla workflow (webhook B) should fire; the Zid workflow (webhook A) should not.
4. If anything still looks off after that, pull the latest `chat-ai` logs and confirm the log line still says `platform= salla kind= PRODUCTION` — if yes, the request is definitely leaving Supabase pointed at the URL in that secret.

## No code changes

- `supabase/functions/chat-ai/index.ts` — unchanged (already routes correctly).
- `public/widget-4.7.33-hostinger.js` — unchanged (widget only talks to `chat-ai`; n8n routing is fully server-side).
- No new migration, no new function.

## Why not edit the widget

The widget never calls n8n directly. It only POSTs to the `chat-ai` edge function with `platform: "salla" | "zid" | …`, and `chat-ai` decides which n8n webhook to forward to. Changing the widget can't fix a wrong secret value.
