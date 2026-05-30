## Findings from the uploaded widget file

- `widget (17).js` contains **no n8n URL at all** — neither production nor test.
- The widget only POSTs to the Supabase Edge Function:
  - `https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/chat-ai`
  - See `sendToBackend()` at lines 2372–2408.
- The n8n URL is used **only inside the `chat-ai` edge function**, via the `N8N_WEBHOOK_URL` secret. The widget itself never knows about n8n.

So the test URL you're seeing is not coming from this JS file.

## Likely real cause

1. **The n8n workflow is not Active.** The production URL `/webhook/get_conversation` only works when the workflow's Active toggle is on. While inactive, n8n only exposes `/webhook-test/get_conversation` (and only for one execution after clicking "Execute workflow").
2. **n8n editor always displays the Test URL** on the Webhook node card — that's UI, not what your backend is actually calling.
3. **The `N8N_WEBHOOK_URL` secret may still be the test value** in the runtime environment, or `chat-ai` hasn't picked up the new value yet.

## Verification plan (no widget changes needed)

1. **Check the secret** — confirm `N8N_WEBHOOK_URL` in Supabase equals exactly:
   ```text
   https://n8n.srv1196634.hstgr.cloud/webhook/get_conversation
   ```
2. **Call `chat-ai` directly** with a minimal payload to reproduce the failure outside the widget.
3. **Read `chat-ai` edge function logs** for the `n8n error <status>` line. A 404 confirms the n8n workflow is not Active or path/method mismatched.
4. **Add a one-line safe log** in `chat-ai` that prints whether the configured URL contains `/webhook-test/` vs `/webhook/`, then redeploy and retry. This proves which URL the function is actually hitting.
5. **If logs show production URL + 404** → fix lives entirely in n8n:
   - Open the workflow with Webhook path `get_conversation`
   - Toggle **Active** on
   - Confirm Method `POST`, Path `get_conversation` (no slash, no spaces)

## What does NOT need to change

- `widget.js` on Hostinger — it never references n8n.
- Any frontend code in this repo.