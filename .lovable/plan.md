## Problem

When the vision model can't confidently identify the product in an uploaded image, the current n8n instruction block still tells the agent to "search the catalog with the suggested queries". With weak signals (e.g. only `color="orange"` + `category="smartphone"`, or only a brand logo), n8n's catalog search can return loosely-related items, and the agent ends up listing random products the customer never asked about. This is both a bad UX and a potential abuse vector (image → unrelated product dump).

## Goal

Only let the agent show catalog products when the image gives us a **specific, high-confidence product identity**. Otherwise, do not search the catalog at all — politely ask the customer to type the product name or describe it more clearly.

## Changes (all in `supabase/functions/chat-ai/index.ts`, vision branch only)

### 1. Add a confidence gate

After parsing the vision JSON, compute:

```
const hasStrongIdentity =
  (product_guess && product_guess_confidence >= 0.7) ||
  // OR brand + specific category + a readable model/SKU text from the image
  (brand_or_logo && category && readable_text && readable_text.length >= 3);
```

`hasStrongIdentity = true` → keep current behavior: pass `search_queries` to n8n with "search catalog, try queries in order" instructions.

`hasStrongIdentity = false` but `has_useful_signal = true` → **new branch (see #2)**.

`has_useful_signal = false` → existing `nonProductShortCircuit` stays as-is.

### 2. New "weak signal" branch — do NOT search catalog

When the image has some signal (e.g. just a brand logo, just a color, just a generic category) but no specific product identity:

- Do **not** include `search_queries` in the payload to n8n.
- Replace the `searchInstruction` block with an explicit "do not search, ask the customer" instruction in Arabic, e.g.:

```
[تحليل الصورة المرفقة]
النوع: <image_kind>
الفئة: <category or "غير محددة">
العلامة: <brand_or_logo or "—">
اللون: <color or "—">
وصف مختصر: <description>
نص ظاهر: <readable_text or "—">

التعليمة الصارمة:
  - الصورة لا تحدد منتجاً بعينه بثقة كافية.
  - ممنوع البحث في الكتالوج أو اقتراح أي منتج بناءً على هذه الصورة وحدها.
  - اطلب من العميل بأدب اسم المنتج كما هو مكتوب، أو وصفاً أوضح (الموديل، الحجم، اللون)، أو رابطاً للمنتج.
  - يمكنك الإشارة باختصار لما رأيته في الصورة (مثلاً: "أرى علامة Apple باللون البرتقالي") لكن بدون عرض أي منتج.
```

### 3. Tighten the `isProduct` / `hasStrongIdentity` branch wording

Keep the multi-variant query block, but harden the existing rule:
- "إذا لم تجد تطابقاً واضحاً في الكتالوج بعد تجربة كل الاستعلامات، **لا تعرض منتجات قريبة أو بديلة**. اذكر للعميل أنك لم تجد المنتج واطلب منه تأكيد الاسم أو إرسال الرابط."

This prevents the same abuse when the strong-identity query also misses.

### 4. Out of scope

- TestChat.tsx, classifier, persistence, n8n workflow file, billing, classify-conversation, vision model choice, schema.

## Outcome

- Orange iPhone with clear cues → still searches catalog for "iPhone 17 Pro Max" variants.
- Brand-only logo / generic colored object / partial photo → no catalog search, agent asks for name/description/link.
- Empty/irrelevant image with no text → still short-circuits as before.
