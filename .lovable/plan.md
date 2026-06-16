## The new problem (from the screenshot)

The customer asked a real, clear question (`هل عندك هذا المنتج؟`) with an image attached. The image is the **Fuqah brand gift logo** — it contains a logo mark and readable text. My previous fix classified it as `icon_or_clipart`/`logo` and replied dismissively: «أعطني اسم المنتج… مو مجرد رسمة». That's wrong. The AI behaves like the image doesn't exist and refuses to even try.

Root cause of the regression: the previous fix collapsed all non-`product_photo` images into a single "refuse and ask for a real photo" branch, ignoring two things:

1. The image often contains **readable text / a brand name / a logo** — that IS searchable info.
2. The customer **did type a real question**, so we have intent + visual context. We should USE both, not refuse.

## Goal

When an image is attached, **the AI must actually use what it sees** — describe it, extract any text/brand/logo, and search the merchant's catalog by that description. It should only refuse when the image truly carries zero searchable signal AND the customer typed nothing.

Concretely:
- Gift logo with "Fuqah" text + customer asks "do you have this?" → AI says: "This looks like our store's gift box / logo with the text Fuqah — did you mean [matched product]? Or did you mean a specific item?" — NOT "send a real photo".
- Random emoji + no text → still short-circuit (existing behavior is correct here).
- Real product photo → catalog match (already works).

## Changes

All edits in `supabase/functions/chat-ai/index.ts` only.

### 1. Reframe the vision prompt — extract searchable signal, don't gatekeep

Replace the current "is_real_product_photo" gating prompt with a richer extraction prompt that always returns the **useful** parts of the image, regardless of kind:

New JSON schema returned by `gpt-4o-mini` vision:
```
{
  "image_kind": "product_photo" | "logo" | "icon_or_clipart" | "screenshot" |
                "emoji" | "receipt_or_document" | "drawing_or_sketch" |
                "person_or_selfie" | "unclear",
  "description": "1-2 objective sentences describing what is visible",
  "readable_text": "literal transcription of any text inside the image, including brand/logo wordmarks",
  "depicted_object": "the main object/subject the image represents (e.g. 'gift box', 'sneaker', 'perfume bottle'), even for icons/logos/drawings — empty only if truly nothing identifiable",
  "brand_or_logo": "any brand/logo name visible, or empty",
  "dominant_colors": ["#hex", ...] (1-3 colors),
  "search_query": "the best short Arabic search phrase a shopper would type to find this in a store catalog — derived from depicted_object + brand + colors. Empty only when nothing identifiable.",
  "has_useful_signal": boolean (true when description, readable_text, depicted_object, brand_or_logo, OR search_query is non-empty)
}
```

Prompt rules:
- Keep "do not assume it's a real product photograph" — but DO extract every searchable detail.
- Explicitly: "A logo, icon, or drawing of a gift box is still meaningful — set `depicted_object='gift box'` and `search_query='علبة هدية'`."
- Keep `detail: "high"` and `response_format: json_object`.

### 2. New branching logic on the result

Replace the current three-branch block:

| Condition | What we inject for n8n | Short-circuit? |
|---|---|---|
| `image_kind === "product_photo"` | "Image: product photo. Description: …. Visible text: …. Instruction: try to match against catalog. Do not confirm availability without a real catalog match." | no |
| `has_useful_signal === true` (any other kind, including logo / icon / drawing / receipt) | "Image kind: {kindAr}. Description: …. Visible text: …. Depicted object: …. Brand: …. Suggested search query: …. Instruction: USE this signal to search the catalog by description/brand/keywords. If you find a likely match, confirm it tentatively and ask the customer to verify. If nothing matches, politely say so and ask for the product name." | no |
| `has_useful_signal === false` AND customer typed text | "Image kind: {kindAr}, no useful information extracted. Instruction: ignore the image and answer the customer's text question normally." | no |
| `has_useful_signal === false` AND no customer text | (skip n8n) reply directly: "وصلتني صورتك لكن ما قدرت أستخرج منها معلومات واضحة. ابعث اسم المنتج أو رابطه وأخدمك 🌷" | yes |

This keeps the protection against hallucinated catalog matches (the agent is told to verify, not confirm blindly) **without** dismissing every non-photograph as garbage.

### 3. Tighten the "do not hallucinate" guardrail in the product-photo branch too

Keep the existing wording «لا تؤكد التوفر إلا إذا وجدت تطابقاً فعلياً» so the original gift-icon → "yes we have it" bug stays fixed.

### 4. Out of scope

- TestChat.tsx — no change.
- classify-conversation function — no change.
- n8n workflow — no change (we only change the `message` payload string sent to it).
- No migrations, no UI work, no other pipeline changes.

## Outcome

- Customer sends Fuqah gift logo + "هل عندك هذا المنتج؟" → AI sees: kind=logo, brand="Fuqah", depicted_object="gift box", search_query="علبة هدية فقاهة" → AI replies: "تقصد علبة هدية فقاهة؟ عندنا [match] / للأسف ما لقيت تطابق، ممكن اسم المنتج بالضبط؟" — using the image, not ignoring it.
- Customer sends raw emoji alone → still short-circuits with the polite ask.
- Customer sends real product photo → catalog match, but the agent must verify before confirming (so the original gift-icon-as-product hallucination stays prevented).
