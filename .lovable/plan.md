# Improve "Unknown Questions" Insight Card

## Problem
The "Unknown Questions" (أسئلة غير معروفة) card lists AI-generated `subject` summaries for conversations the classifier bucketed as `other`. For unknown questions these summaries are vague ("سؤال غير مفهوم", "محادثة عامة"), so the store owner can't tell what the customer actually asked or act on it.

## Goal
Replace the vague summary with the **actual question the customer asked that the AI failed to answer**, presented clearly with light context (Arabic excerpt, date, link to the conversation).

## Changes

### 1. Backend — extract a real unanswered question per "other" conversation
File: `supabase/functions/classify-conversation/index.ts`
- Extend the model's JSON output with an extra field used **only when category = other**:
  - `unanswered_question`: the exact customer message (verbatim, ≤ 200 chars) that the AI did not or could not answer. Empty string if none.
- Update the prompt to:
  - Pick the most representative customer question the assistant couldn't answer, fell back on, or escalated.
  - Return the customer's wording (no paraphrase).
- Persist it on `conversations_main` in a new column `unanswered_question text` (new migration with proper GRANTs already present on the table; column add only).

### 2. Data source for the card
File: `src/app/services/metrics.ts` → `fetchTopSubjectsByCategory`
- For the `other` bucket only, select `unanswered_question, last_message_at, id` instead of `subject`.
- Build the list from `unanswered_question` (fallback: first customer message body from `conversations_messages` for legacy rows where the new column is null).
- Group near-duplicate questions (normalize whitespace + lowercase + strip punctuation) and keep a `count` + a representative original phrasing + a `conversationId` of the most recent occurrence.
- Return shape stays `TopSubject[]` but extended: `{ id, subject, count, conversationId?, lastAt? }`.

### 3. Card rendering
File: `src/app/components/DashboardPage.tsx` (Insight Modal block)
- When `openInsight === 'unknown'`:
  - Render each item as a quoted question (with Arabic quotation marks « »), monospace-free, full text wrapped (no truncation).
  - Show a small meta row: relative date of last occurrence + "فُتحت X مرة" badge.
  - Add an "افتح المحادثة" button that navigates to `/dashboard/conversations?open=<conversationId>` so the owner can read the full context.
  - Keep existing Resolve / Delete buttons.
- Empty state copy: "لا توجد أسئلة لم يتمكن الذكاء من الإجابة عليها في هذه الفترة."

### 4. Backfill (one-time)
- For existing `other` conversations with null `unanswered_question`, populate from the first `conversations_messages` row where `sender = 'customer'` (SQL update in the same migration).

## Out of scope
- Re-classifying past conversations through the LLM.
- Changing the donut chart (already filtered to 4 categories).
- Per-question merge UI / manual editing.

## Technical notes
- New column: `ALTER TABLE public.conversations_main ADD COLUMN unanswered_question text;` (existing GRANTs cover it).
- Normalization for grouping: trim, collapse internal whitespace, strip trailing `؟?.!،,` and Arabic diacritics before hashing.
- Cap fetched rows at 500 unknown conversations per range to keep the dashboard fast; group then take top 8.
