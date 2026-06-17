## Plan

Switch vision model to **GPT-5** and keep the "identify but never substitute" guardrail.

### Changes to `supabase/functions/chat-ai/index.ts`

1. **Use `gpt-5` for image analysis**
   - Set `VISION_MODEL = Deno.env.get("VISION_MODEL") ?? "gpt-5"`.
   - Keep `detail: "high"` and `max_tokens: 1200`.
   - Add `gpt-5` to `MODEL_PRICING` (~$1.25 input / $10.00 output per 1M tokens) so cost logging stays accurate.
   - Cheaper classifiers stay on `gpt-4o-mini`.

2. **Identify, never substitute** (kept from previous plan)
   - Vision describes what it sees (e.g. "جراب iPhone برتقالي") but the reply must NOT name any other catalog SKU.
   - For image-only messages with no explicit model name in caption / on-image text: skip catalog search, skip product cards, and ask the customer to confirm the exact model.
   - Image + explicit model name in text → existing text-override path runs catalog search.
   - Add an explicit assistant-prompt guardrail forbidding suggestions of different products from an image alone.

3. **Per-image token + cost logging**
   - Log `{ vision_model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, conversation_id }` per vision call so you can compare gpt-5 vs gpt-4o real spend.

### Notes on GPT-5 via the gateway
- GPT-5 is available on the Lovable AI Gateway as `openai/gpt-5` (multimodal, text + image input).
- It is the strongest of the candidates for distinguishing recent iPhone generations from a back-of-case photo, but even GPT-5 will sometimes be uncertain — the guardrail (#2) is what prevents wrong-product suggestions, not the model upgrade.
- Pricing is roughly equal to gpt-4o per image at high detail, with better accuracy.

### Out of scope
- No DB / ticket / widget / dashboard changes.
- Text-only messages unchanged.
