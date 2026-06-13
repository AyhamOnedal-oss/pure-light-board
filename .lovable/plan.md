# Fix: conversation shows "بدون" in list and "استفسار" in details

## Root cause

The list badge and the detail badge read **two different columns** of `conversations_main`:

- **List item** (`ConversationsPage.tsx` line ~373) renders from `c.category`. When `category` is `null` it falls back to the `'none'` key → "بدون".
- **Detail header** (line ~485) renders `<IntentBadge type={selected.intentType} />`, which reads `intent_type`.

The classifier sets `intent_type` reliably (one of `inquiry/complaint/request/suggestion`) but the standalone `category` column is sometimes left `NULL` (e.g. when the structured classifier output didn't fill it, or for older rows). Result: same conversation, list says "بدون" while detail says "استفسار".

Confirmed in code: line 179 maps `category` only if it's one of the four canonical values, otherwise `undefined`. `intentType` is mapped separately from `intent_type`.

## Fix (UI only — no schema change)

In `src/app/components/ConversationsPage.tsx`:

1. **Single source of truth for the badge**: when building each row (line ~179), set
   ```
   category: canonicalize(c.category) ?? canonicalize(c.intent_type)
   ```
   so `intent_type` fills in whenever `category` is null. This keeps the list/detail in sync without touching the DB.
2. **Drop the "بدون" badge** when both fields are empty — show nothing instead of a meaningless label (the badge currently fabricates a category that doesn't exist).

That's it. No migration, no edge function, no detail-panel change needed: once the row's `category` is derived from `intent_type` as fallback, the list and the detail header will always agree.

## Files touched

- `src/app/components/ConversationsPage.tsx` — fallback mapping for `category`; conditional render of the badge.

## Out of scope

- Backfilling `conversations_main.category` from `intent_type` in the DB. Can be done later if other surfaces (admin, exports) need it; the UI fix is sufficient for what the user reported.
