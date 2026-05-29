## Goal

Switch the AI chat from n8n's **test** webhook to the **production** webhook:

- From: `https://n8n.srv1196634.hstgr.cloud/webhook-test/get_conversation`
- To:   `https://n8n.srv1196634.hstgr.cloud/webhook/get_conversation`

## Findings

The URL is **not** hardcoded anywhere in the repo. The only consumer is:

- `supabase/functions/chat-ai/index.ts` (line 13) — `const N8N_WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL")`

The widget (`widget/src/app/utils/chatApi.ts`) calls the `chat-ai` edge function, which then POSTs to n8n. So the widget bundle does **not** need any code change and does **not** need to be re-uploaded to Hostinger for this switch.

## Steps

1. **Hostinger / n8n** — make sure the workflow at `…/webhook/get_conversation` is **Active** (production endpoint only works when the workflow is activated; the `webhook-test/…` URL is what n8n shows while the editor is open).
2. **Supabase secret** — update `N8N_WEBHOOK_URL` to:
   ```
   https://n8n.srv1196634.hstgr.cloud/webhook/get_conversation
   ```
   (Lovable Cloud → Backend → Edge Function Secrets, or `supabase secrets set N8N_WEBHOOK_URL=…`)
3. **Verify** — send a test message from the storefront widget / TestChat; confirm a reply comes back and that the n8n production workflow shows a new execution (Executions tab, not the test panel).
4. **Docs touch-up (optional)** — `docs/n8n/README.md` already says to paste the **production** webhook URL into `N8N_WEBHOOK_URL`; no edits required unless you want to add an explicit "do not use `/webhook-test/…`" warning.

## Nothing to change in widget.js

`widget/dist/widget.js` on Hostinger is unaffected — re-uploading it is not needed for this switch.
