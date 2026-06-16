## Problem (from the screenshot)

The customer sent a **gift icon** (simple clipart, not a real product photo), and the AI replied "Sure, we have this product." Root cause is in `supabase/functions/chat-ai/index.ts` (lines 340-400): the current vision pre-processing **biases the model toward assuming it's a product**:

```
"If it looks like a product, say so and guess the category"
```

On top of that:
- `detail: "low"` → shallow image analysis
- `max_tokens: 250` → short description with no image-type classification
- The description is injected into the user message with no signal that it might be an icon / emoji / clipart
- The main n8n agent then receives "description: gift" and matches it against the merchant's catalog, confirming availability

## Goal

1. **Analyze the image first, accurately**: classify the image type (real product photo / screenshot / icon / emoji / drawing / logo / receipt / unclear) BEFORE any catalog matching.
2. **Block availability claims from icons/emoji**: if the image is not a real product photo, the AI asks the customer for the actual product photo or name — it must not confirm availability.
3. **Text is read AFTER the image** and merged with it explicitly (image is primary context, text is secondary).

## Changes

All edits in `supabase/functions/chat-ai/index.ts` only — no migration, no UI change, no impact on the rest of the pipeline.

### 1. Rewrite vision pre-processing (lines 340-400)

Replace the current call with a stronger one that returns **structured JSON** instead of free-form text:

- Keep `model: "gpt-4o-mini"` (vision-capable, cheap), but:
  - `detail: "high"` instead of `"low"` (a small icon needs higher fidelity to distinguish from a product photo)
  - `max_tokens: 400`
  - `response_format: { type: "json_object" }`
- **New system prompt** that forces the model to return:
  1. `image_kind` ∈ `product_photo` / `screenshot` / `icon_or_clipart` / `emoji` / `logo` / `receipt_or_document` / `drawing_or_sketch` / `person_or_selfie` / `unclear`
  2. `is_real_product_photo: boolean` — explicit
  3. `description`: 1-2 objective sentences (no "this is a product" if it's an icon)
  4. `readable_text`: any text visible in the image (literal transcription)
  5. `suggested_action`: `match_to_catalog` only if `is_real_product_photo=true`; otherwise `ask_for_real_photo` or `answer_text_only`
- Wording explicitly removes the current bias: "Do NOT assume it's a product. Describe what you actually see. Icons, emoji, and clipart are NOT products."
- Concrete example inside the prompt: "Cartoon image of a wrapped gift box with a ribbon = `icon_or_clipart`, NOT product_photo."

### 2. Inject the vision result into the agent message in a directive form

Instead of the current line:
```
[Image description: ...]
```

Inject a structured block that tells the n8n agent how to behave:

- If `is_real_product_photo = true`:
  ```
  [Attached image analysis]
  Kind: product photo
  Description: {description}
  Visible text: {readable_text || "none"}
  Instruction: try to match this product against the store catalog.
  ```
- If `false` (icon/emoji/drawing/…):
  ```
  [Attached image analysis]
  Kind: {image_kind in Arabic} — NOT a real product photo
  Description: {description}
  Critical instruction: do NOT confirm availability of any product based on this image. Ask the customer for the actual product photo, name, or link.
  ```
- If `unclear`: ask for clarification instead of guessing.

### 3. If no text + image is not a product → short-circuit reply

Current lines 335-337 set a default caption "describe the attached image…". We adjust: if pre-processing returns `is_real_product_photo=false` AND the customer sent no text, **skip the n8n call** and reply directly with:
> "I got your image, but it looks like {an icon/emoji/…}, not a real product photo. Did you mean a specific product? Send its name or an actual photo and I'll help."

This saves n8n cost and prevents hallucination in the classic failure case.

### 4. Vision failure fallback

Keep current behavior (ignore image, continue with text only) — no change.

### 5. Out of scope

- `TestChat.tsx` (the UI is fine; it uploads a base64 data URL which vision supports).
- Rest of pipeline (classifier, persistence, n8n call, billing).
- `classify-conversation` function.

## Outcome

After the change: sending a gift icon will no longer produce "yes, available." The AI will say "this is an icon, please send the product name or an actual photo." Real product photos will be analyzed with higher fidelity (`detail: high`) before catalog matching.
