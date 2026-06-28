## Problem
On `/admin/customers/:id`, "الكلمات المستخدمة" shows **19,304** (real billed words from `dashboard_usage_daily.words_used`), but the new "كلمات المدخلات / المخرجات" tiles show **51,513 / 2,520** (≈54k). The two views disagree because the tiles convert raw tokens with a flat `tokens * 0.75` factor, which is the English ratio. Arabic is far less token‑efficient (≈3.5–4 tokens per word), and images add prompt tokens that aren't "words" at all, so the flat factor wildly over‑states input words and the input/output split no longer reconciles with the total the customer is actually billed for.

## Fix
Make the input/output word numbers a **proportional split of the already‑correct total** (`words_used`), using the input/output token ratio as the weight. This guarantees `inputWords + outputWords === الكلمات المستخدمة` for every tenant, for both text and image traffic, without picking a fragile per‑language constant.

```text
totalWords  = dashboard_usage_daily.words_used (sum over range)
inTok       = sum(ai_classifier_usage.prompt_tokens)
outTok      = sum(ai_classifier_usage.completion_tokens)
ratioIn     = inTok / (inTok + outTok)        // fallback 0.9 if both 0
inputWords  = round(totalWords * ratioIn)
outputWords = totalWords - inputWords         // exact remainder, no drift
```

For this tenant: 68,684 / (68,684 + 3,360) ≈ 0.953 → **~18,394 input / ~910 output**, summing exactly to **19,304**. ✅

## Changes
- `src/app/components/admin/AdminCustomerDetails.tsx`
  - Replace the `tokens * 0.75` math in the two tiles and the two subscription‑card rows with the proportional split above.
  - Keep the existing token query (still needed for the ratio) but never display token counts.
  - If `dashboard_usage_daily` is empty for the range, fall back to `0 / 0` (don't synthesize from tokens).

No DB migration, no edge function, no changes to merchant‑side dashboards or billing.

## Verification
- Reload `/admin/customers/4257914d-…`: tiles read ~18,394 / ~910 and the two subscription rows match; their sum equals 19,304 shown above.
- Spot‑check a second tenant with image traffic — sum still matches `الكلمات المستخدمة` exactly.
