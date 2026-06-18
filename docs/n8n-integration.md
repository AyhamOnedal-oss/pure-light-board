# n8n integration for Fuqah AI Agent

Your storefront widget calls `chat-ai`, which forwards every message to your
n8n webhook. The merchant's saved prompt and file are already inside that
payload — n8n just needs to bind them to the AI Agent node.

## Per-platform webhook routing

`chat-ai` picks the n8n webhook URL based on the resolved store platform:

- `N8N_WEBHOOK_URL_ZID` — used for Zid stores (webhook A)
- `N8N_WEBHOOK_URL_SALLA` — used for Salla stores (webhook B)
- `N8N_WEBHOOK_URL` — fallback for manual/unknown platforms and when a per-platform URL is unset

No widget or dashboard change is needed — the widget already sends `platform`, and routing happens server-side.

## 1. Payload that arrives at the n8n Webhook node

```json
{
  "tenant_id": "uuid",
  "conversation_id": "uuid",
  "visitor_id": "anon-...",
  "message": "user's question",
  "attachments": [
    { "url": "https://...signed-url", "content_type": "image/png", "name": "photo.png" }
  ],
  "history": [
    { "sender": "customer", "body": "..." },
    { "sender": "ai", "body": "..." }
  ],
  "store": {
    "name": "Acme Store",
    "locale": "ar",
    "domain": "acme.zid.sa",
    "platform": "zid"
  },
  "ai": {
    "mode": "prompt",       // or "file"
    "prompt": "merchant's saved system prompt (null if mode = file)",
    "file_url": "https://... (null if mode = prompt)"
  }
}
```

`attachments` is empty `[]` when the user didn't attach anything. URLs are 1-hour
signed URLs to a private Supabase Storage bucket — they expire, so don't cache them.

## 2. Wire it up in n8n (matches the flow in your screenshot)

| Node                  | Field                  | Value                                    |
|-----------------------|------------------------|------------------------------------------|
| Webhook (Get Conv.)   | HTTP Method            | `POST`                                   |
| AI Agent              | Prompt Type            | `Define below`                           |
| AI Agent              | User Message           | `={{ $json.message }}`                   |
| AI Agent              | System Message         | `={{ $json.ai.prompt }}`                 |
| OpenAI Chat Model     | Model                  | your choice (gpt-4o-mini works well)     |
| Respond to Webhook    | Response Body          | `={{ { "reply": $json.output } }}`       |

### Vision (image attachments)

To let the agent "see" attached images, switch the OpenAI Chat Model to
`gpt-4o-mini` (or any vision-capable model) and replace the AI Agent's
**User Message** with this expression:

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

That's the only change required. Text-only messages keep working unchanged.

If `ai.mode === "file"`, add an HTTP Request node before the AI Agent:

| Node              | Field      | Value                       |
|-------------------|------------|-----------------------------|
| HTTP Request      | Method     | `GET`                       |
| HTTP Request      | URL        | `={{ $json.ai.file_url }}`  |
| HTTP Request      | Response   | `String`                    |

Then in the AI Agent's System Message, append the file content:

```
={{ $json.ai.prompt || '' }}

Reference document:
{{ $node["HTTP Request"].json.data }}
```

## 3. Optional: pull prompt on demand from `widget-context`

If you'd rather not rely on the payload, every n8n run can `GET` the latest
saved prompt and file directly from Supabase:

```
GET https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/widget-context?tenant_id={{ $json.tenant_id }}
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <SUPABASE_ANON_KEY>
```

Response:

```json
{
  "tenant_id": "...",
  "mode": "prompt",
  "prompt": "...",
  "file_url": null,
  "file_name": null,
  "store": { "name": "...", "locale": "ar", "domain": "...", "platform": "zid" }
}
```

This endpoint is read-only and not cached, so whatever the merchant just
saved in the dashboard is what n8n sees on the very next run.

## 4. Expected Respond-to-Webhook shape

`chat-ai` accepts any of these field names in the response body:
`reply`, `message`, `text`, or `output`. The recommended shape is:

```json
{ "reply": "the assistant's answer to show in the chat bubble" }
```