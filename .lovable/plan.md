## Problem

In the screenshot, the customer sent a clear photo of an **iPhone 17 Pro Max in orange** (with the distinctive MagSafe ring, camera plateau, and Apple logo, on a SmartBuy listing card). The agent identified the brand only as "Apple" and replied: "couldn't find a real match for an orange iPhone, what model — 11/12/13/14?". The model list it offered (11–14) shows the search signal we passed to n8n was too generic ("orange iPhone") and outdated, so the catalog lookup failed.

Root causes:
1. **Vision extraction is too shallow.** The current prompt asks for `depicted_object` ("iPhone") and one `search_query`. It does not push the model to read on-device cues (camera layout, MagSafe ring, body shape, finish), retailer overlays (SmartBuy badge, price, SKU text), or visible labels — all of which pin down the exact model/variant. It also returns only ONE query, in Arabic only.
2. **n8n only gets one query string**, so if the merchant's catalog indexes the product as "iPhone 17 Pro Max" (English) or "ايفون ١٧ برو ماكس" (Arabic numerals) and we pass "آيفون برتقالي" it won't hit.
3. **No model-knowledge anchoring.** We don't tell the vision model it's allowed to name a likely specific model (e.g. "iPhone 17 Pro Max, Orange") when the visual cues are strong, with a confidence score.

## Goal

When an image contains a recognizable product, the agent should pass n8n a **rich, multi-variant search payload** (specific model name in Arabic + English + transliteration + brand + color + category + retailer text), and n8n should try each variant against the catalog before giving up.

Example desired behavior for the screenshot:
- Vision returns `product_guess="iPhone 17 Pro Max"`, `confidence=0.85`, `color="orange"`, `brand="Apple"`, `retailer_text="SmartBuy"`, `search_queries=["iPhone 17 Pro Max Orange","Apple iPhone 17 Pro Max","ايفون ١٧ برو ماكس برتقالي","آيفون 17 برو ماكس","iphone 17 pro max"]`.
- Agent reply (in Arabic): "تمام، هذا يبدو آيفون 17 برو ماكس باللون البرتقالي من Apple — خلّيني أتحقق من الكتالوج… [match | not in stock]".

## Changes (all in `supabase/functions/chat-ai/index.ts`, vision block lines ~353-513)

### 1. Expand the vision JSON schema

Add these fields to the JSON the model returns:

```
"product_guess":           string  // best specific product name with model+variant if confident (e.g. "iPhone 17 Pro Max"), else ""
"product_guess_confidence": number // 0.0–1.0
"category":                string  // e.g. "smartphone", "sneaker", "perfume"
"color":                   string  // primary color in English (single word) for cross-lang search
"retailer_or_source_text": string  // any retailer/store badge or price text visible (e.g. "SmartBuy", "299 SAR")
"search_queries":          string[] // 3–6 query variants ordered most-specific first, covering: full product name in English, full product name in Arabic (both Arabic & Hindi digits if it contains a number), brand only, brand + category + color, generic category + color. Empty array only if has_useful_signal=false.
```

Keep existing fields (`image_kind`, `description`, `readable_text`, `depicted_object`, `brand_or_logo`, `dominant_colors`, `has_useful_signal`). Drop the single `search_query` string (replaced by the array).

### 2. Strengthen the vision system prompt

Add explicit instructions:
- "Look for distinctive product cues to name the specific model/variant: phone camera layout and count, MagSafe/Dynamic Island, body material/finish, sneaker silhouette, perfume cap shape, watch dial. Combine with any visible text/logo/retailer badge."
- "If you are at least ~70% confident of the specific model, set `product_guess` to the full model name in English (e.g. 'iPhone 17 Pro Max', 'Nike Air Force 1 Low White'). If unsure, leave it empty and rely on category+brand+color."
- "Always produce queries in BOTH English and Arabic when the product has a recognizable international name. For Arabic queries containing numbers, include BOTH Arabic digits (1,2,3) AND Hindi/Eastern digits (١,٢,٣) as separate variants — Saudi catalogs use both."
- "Never invent specifications you can't see (storage size, RAM, year). Only name what visual cues support."

Bump `max_tokens` to 700 to fit the richer JSON.

### 3. Rewrite the block injected for n8n (the `isProduct` and `usefulSignal` branches)

Replace the single `اقتراح بحث في الكتالوج: <one query>` line with:

```
[تحليل الصورة المرفقة]
النوع: صورة منتج
الفئة: smartphone
العلامة: Apple
المنتج (تخمين بصري): iPhone 17 Pro Max  (ثقة 0.85)
اللون: orange / برتقالي
نص ظاهر داخل الصورة: <readable>
نص بائع/مصدر: SmartBuy
استعلامات بحث مقترحة (جرّبها بالترتيب حتى تجد تطابقاً):
  1) iPhone 17 Pro Max Orange
  2) Apple iPhone 17 Pro Max
  3) ايفون 17 برو ماكس برتقالي
  4) آيفون ١٧ برو ماكس
  5) iphone pro max orange
التعليمة:
  - ابحث في كتالوج المتجر باستخدام كل استعلام بالترتيب حتى تجد تطابقاً.
  - إذا وجدت تطابقاً، أكّد للعميل اسم المنتج كما هو في الكتالوج واسأله إن كان هذا ما يقصد.
  - إذا لم تجد بعد كل المحاولات، قل ذلك بأدب واذكر تخمينك البصري ("يبدو لي أنه iPhone 17 Pro Max برتقالي") واطلب من العميل تأكيد الاسم أو رابط المنتج.
  - لا تقترح على العميل قائمة موديلات قديمة عشوائية إذا الصورة تشير لموديل محدد.
```

The last bullet directly fixes the "وش اسم موديل الآيفون بالضبط (مثلاً 11/12/13/14)" regression.

### 4. Keep the existing guardrails

- The `nonProductShortCircuit` path (no useful signal AND no customer text) stays as-is.
- "Do not confirm availability without a real catalog match" stays in the `isProduct` branch.
- TestChat.tsx, classifier, persistence, n8n workflow, billing: unchanged.

### 5. Out of scope

- No DB/schema changes.
- No changes to the n8n workflow file (we only change the `message` payload string).
- No UI changes.
- No change to vision model — still `gpt-4o-mini` with `detail: "high"` (sufficient to read camera layout / MagSafe ring; upgrading to `gpt-4o` is a separate cost decision).

## Outcome

- iPhone 17 Pro Max photo → vision returns specific model + 5 query variants in two languages → n8n tries each → either finds it or explicitly says "I can see it's an iPhone 17 Pro Max in orange but I don't have it listed — can you confirm the exact name or send a link?" instead of asking the customer to pick from 11/12/13/14.
- Fuqah gift logo (previous case) → still works: `product_guess=""`, but `depicted_object`, `brand`, and multi-variant `search_queries` are passed.
- Random emoji alone → still short-circuits.
