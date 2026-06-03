## Option A: Vision pre-processing in `chat-ai` edge function

Add a vision step before the n8n call. If `attachments` contains images, call OpenAI `gpt-4o-mini` (already used as classifier, `OPENAI_API_KEY` already set) to describe the image, then inject the description into `message` sent to n8n. n8n agent stays text-only and no longer needs changes.

### Changes

**`supabase/functions/chat-ai/index.ts`** — after the existing attachment validation (around line 296), before `resolveTenant`:

1. Call OpenAI chat completions with `gpt-4o-mini`, `detail: "low"`, `max_tokens: 250`.
2. Send all attachments as `image_url` content parts together with the user's caption.
3. System prompt: 1–3 short sentences describing product type, brand/text, color, distinguishing features; transcribe visible text; reply in the user's language.
4. On success: rewrite `userText` to `"<original caption>\n\n[وصف الصورة المرفقة: <vision output>]"`.
5. On failure (HTTP error, timeout, no key): log and fall through — send the original message without the description so the chat doesn't break.
6. Log `vision_usage` with prompt/completion/total tokens + estimated cost (uses existing `estimateCost`).

No frontend change. No n8n workflow change. No new secret.

### Token + cost per request (gpt-4o-mini vision, `detail: "low"`)

`detail: "low"` is a **fixed 2,833 image tokens per image** (OpenAI's mini multiplier × the 85-token base), regardless of resolution. So:

| Per request | Input tokens | Output tokens | Cost (USD) |
|---|---|---|---|
| Text prompt overhead | ~150 | — | — |
| 1 image | 2,833 | up to 250 | ~$0.00060 |
| 2 images | 5,666 | up to 250 | ~$0.00102 |
| 4 images (max) | 11,332 | up to 250 | ~$0.00184 |

Pricing: gpt-4o-mini = $0.15 / 1M input, $0.60 / 1M output (already in `MODEL_PRICING`).

So a typical single-image test message costs **≈ $0.0006 (≈ 6 cents per 100 images)**. Negligible.

If you ever want sharper vision (read tiny text, count items), switch the vision call to `detail: "high"` — that becomes ~5,667 + ~5,667 per 512px tile, so a 1024×1024 image runs ~25k input tokens (~$0.0038). Not needed now.

### After implementation

I'll deploy `chat-ai` and ask you to send a test image so we can confirm `vision_usage` shows in logs and the agent's reply references the image content.