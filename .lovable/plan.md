## Goal
Classifier outputs one of **5 categories**: `inquiry`, `complaint`, `request`, `suggestion`, or `other` (`أخرى`).
- 4 real categories require a real customer intent, chosen by **dominant intent across the whole transcript** (not the last message), ignoring internal system actions like "raise a ticket" or "end conversation".
- `other` / `أخرى` covers **any conversation without one of the 4 real intents**: gibberish (`ىؤتيراهاالر`, `يسهتارخقا`), random keystrokes, empty/test messages, and **pure greetings/thanks/chit-chat with no follow-up question or request** (e.g. only `السلام عليكم`, only `شكراً`, only `هلا`, only emojis).

## Scope
- `supabase/functions/classify-conversation/index.ts` — prompt + post-parse + fallback.
- `src/app/components/ConversationsPage.tsx` — render `أخرى` as a real category chip and stop filtering it out.

No DB migration.

## Changes

### 1. Prompt — dominant intent rule
Add before the examples block:
- Read the **entire** transcript. Pick the customer's **dominant / most impactful intent**, not the last message.
- For multi-intent conversations (e.g. inquiry → side suggestion → "raise a ticket") pick the one with the most substance.
- **Ignore as category signals** (system actions, not customer intent):
  - "ارفع تذكرة", "أبغى أتواصل مع موظف", "حولني لموظف"
  - "أنهي المحادثة", "خلاص شكراً انهِ"
- These never decide the category.

### 2. Prompt — strict definition of `other`
Use `other` **only** when the conversation has no real customer intent among the 4. This includes:
- Gibberish / random characters: `ىؤتيراهاالر`, `asdfgh`, `يسهتارخقا`.
- Empty / whitespace-only messages or test pings.
- **Pure greetings, thanks, or chit-chat with no follow-up question, complaint, request, or suggestion**: e.g. only `السلام عليكم`, only `مرحبا`, only `هلا`, only `شكراً`, only `تمام`, only emojis.
- If a greeting is **followed** by a real question/complaint/request/suggestion, classify by that real intent — not `other`.
If even a partial real intent exists, pick one of the 4 buckets.

Add worked examples:
```
Example 15:
CUSTOMER: ىؤتيراهاالر
CUSTOMER: يسهتارخقا
→ category: other, intent_type: inquiry
(Gibberish — no real intent.)

Example 16:
CUSTOMER: السلام عليكم
→ category: other, intent_type: inquiry
(Greeting only, no follow-up — no real intent.)

Example 17:
CUSTOMER: شكراً
CUSTOMER: 🌹
→ category: other, intent_type: inquiry
(Thanks + emoji only — no real intent.)

Example 18:
CUSTOMER: السلام عليكم، أبغى أعرف هل عندكم توصيل للدمام؟
CUSTOMER: بالمناسبة ياليت تضيفون طرق دفع أكثر
CUSTOMER: طيب ارفعوا لي تذكرة عشان أتابع
→ category: inquiry, intent_type: inquiry
(Dominant intent is shipping inquiry. Suggestion is a side note;
"raise a ticket" is a system action — ignored.)
```

### 3. Post-parse + fallback
- Keep `ALLOWED_CATEGORIES` = `['complaint','inquiry','request','suggestion','other']`.
- Fallback writer stays `category: "other"` (we genuinely don't know when OpenAI fails).

### 4. `ConversationsPage.tsx`
- Add `'other'` to the `ChatCategory` union.
- `categoryMap`:
  ```
  other: { en: 'Other', ar: 'أخرى', color: '#8b95a8' }
  ```
- Include `'other'` in the `allowed` array (~line 181) so it isn't dropped from rendering.
- Remove the unused `none` entry.
- If a category filter dropdown exists, add `Other / أخرى` to it (confirmed during implementation).

## Out of scope
- No backfill. Newly analyzed conversations follow the new rules; existing rows already stored as `other` will now render as `أخرى` instead of being hidden.

## Verification
- Re-analyze a `السلام عليكم`-only conversation → `أخرى`.
- Re-analyze a gibberish conversation → `أخرى`.
- Re-analyze a conversation that starts with a greeting then asks about shipping → `استفسار`.
- Re-analyze a multi-intent conversation ending with "ارفع تذكرة" → category reflects the dominant earlier intent, not `request`.
