## Goal
1. Remove the yellow warning banner from Test Chat ("الكلمات المستخدمة في هذا الاختبار تُحسب كاستخدام إدخال وإخراج").
2. Replace every "words / كلمات" concept in the **user dashboard** (not admin) with "conversations / محادثات", using token data as the underlying source.

## Conversion formula
Per user spec: **1 conversation ≈ 50,000 input tokens + 5,000 output tokens.**

To stay conservative (don't undercount usage against quota), we compute:
```
conversations = ceil( max( input_tokens / 50_000 , output_tokens / 5_000 ) )
```
Centralized in one helper `tokensToConversations(input, output)` in `src/app/utils/conversations.ts` so we can tweak later in one place.

## Files to change (UI / logic in user panel only)

### 1. `src/app/components/settings/TestChat.tsx`
- Delete the `<Alert>` block (lines ~318–326) carrying the bilingual "Words used…" notice. No replacement.

### 2. New `src/app/utils/conversations.ts`
- Export `tokensToConversations(input, output)` and `INPUT_PER_CONVO = 50_000`, `OUTPUT_PER_CONVO = 5_000`.

### 3. `src/app/services/metrics.ts`
- Pull `input_tokens` / `output_tokens` per tenant from `merchant_token_daily` for the current and previous period (alongside existing `dashboard_usage_daily` query).
- Replace the `wordsUsed` field on the returned object with `conversationsUsed` (keep the same numeric type and trend slot). Delta % computed against previous period the same way.
- Remove references to `ai_words_used` for the user-facing metric (the DB column stays; we just stop surfacing it).

### 4. `src/app/components/DashboardPage.tsx`
- Replace the "Words Consumed / الكلمات المستهلكة" tile (line 174) with **"Conversations / المحادثات"** bound to `metrics.conversationsUsed`.
- Keep the same icon style or swap `FileText` → `MessagesSquare` from lucide for clarity.
- Update the inline comment on line 24.

### 5. `src/app/components/settings/PlansPage.tsx`
- Stop reading `monthly_word_quota` / `monthly_words_used` for display. Instead:
  - Read `input_tokens` + `output_tokens` for current billing month from `merchant_token_daily` → `conversationsUsed`.
  - Convert `monthly_word_quota` (legacy words) → `conversationsQuota` using the same ratio so the existing plan rows still render. (Formula: `quota_words / ((50000+5000)/2)` ≈ `quota_words / 27_500`.) Alternatively, if `settings_plans` already has a conversation column we can add a `monthly_conversation_quota` field — see "Schema (optional)" below.
- Update all labels: "إجمالي الكلمات" → "إجمالي المحادثات", "استخدام الكلمات" → "استخدام المحادثات", "الكلمات المستخدمة" → "المحادثات المستخدمة", donut legend "مستخدم/متبقي" stays.
- `formatNumber` and the `useAnimatedNumber` calls operate on the new conversation counts (no `/1000` k-format — conversation numbers are small).

### 6. `src/app/context/AppContext.tsx`
- Update the 80%-usage notification:
  - `titleAr: 'اقتراب من حد المحادثات'`
  - `messageAr: 'لقد استخدمت 80% من حصة المحادثات الشهرية.'`
  - English equivalents updated too.
- Threshold logic switches from words-based to conversations-based (uses the helper).

### 7. Optional schema addition (recommended, not required)
Add a nullable `monthly_conversation_quota INTEGER` to `public.settings_plans`, backfilled as `ROUND(monthly_word_quota / 27500)`. UI prefers this column when present; falls back to the derived value otherwise. This keeps the door open to retire word quotas entirely later without another UI pass.

## Out of scope (intentionally untouched)
- Admin panel ("الكلمات" cards, `admin_dash_words_monthly`, `MerchantConsumptionTable`, `OpenAIKeysCard`, `adminCustomers.ts`).
- Edge functions and OpenAI usage sync (still token-based internally).
- DB columns `monthly_word_quota`, `monthly_words_used`, `ai_words_used` (kept; admin still uses them).

## Verification
- Test Chat: banner gone, page layout unchanged.
- Dashboard: tile shows "المحادثات" with a small integer (e.g. 12) instead of word count.
- Plans page: quota progress + donut reflect conversation counts; percentage math sane against `merchant_token_daily` totals for the tenant.
- 80% notification fires when `conversationsUsed / conversationsQuota ≥ 0.8`.
