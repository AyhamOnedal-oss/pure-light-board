## Plan

Got it — the fix is on the vision side, not tickets. Increasing tokens alone won't reliably tell iPhone 17 Pro Max from iPhone 14 (they look very similar). We need a stronger vision model + more output room + customer text override.

1. **Upgrade the vision model for image analysis**
   - In `supabase/functions/chat-ai/index.ts`, change the vision call from `gpt-4o-mini` to a stronger vision model (e.g. `gpt-4o` or `gpt-4.1`).
   - Keep `gpt-4o-mini` for the cheap intent classifiers — only the image step gets upgraded.

2. **Give the vision step more tokens to "think"**
   - Raise `max_tokens` on the vision request so it can return full reasoning + all `search_queries` without truncation.
   - Keep `detail: "high"` (already set) so fine cues like Camera Control button / camera island shape are actually visible.

3. **Add MODEL_PRICING entry for the new vision model**
   - Update the `MODEL_PRICING` map so cost logging stays accurate for the upgraded model.

4. **Customer text & readable-image text override visual guess**
   - If `message` (caption) or `readable_text` contains an explicit model name (e.g. "iPhone 17 Pro Max", "آيفون 17 برو ماكس"), use that as `product_guess` and override any older-model guess from vision.
   - Prepend the explicit model to `search_queries` (EN + AR + Eastern-Arabic digits) so the catalog search hits the correct SKU.

5. **Tighten the strong-identity gate for iPhones**
   - When vision returns an iPhone guess with confidence < 0.8 AND there is no model name in caption/readable text, do NOT treat it as strong identity.
   - Fall through to the existing "ask the customer for the exact model" branch (`askForNameInstruction`) instead of searching with a wrong model.

6. **Logging**
   - Log when caption/readable text overrides the vision guess (`vision_override`), and log the final `product_guess` actually used, so we can verify the upgrade is paying off.

## Out of scope

- No DB changes.
- No tickets/escalation logic changes.
- No widget/dashboard UI changes.
- Classifier models stay on `gpt-4o-mini`.

## Cost note

Vision will become more expensive per image (stronger model + more tokens). Text-only messages are unaffected.