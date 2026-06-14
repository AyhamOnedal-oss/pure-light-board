## Problem

The conversation in the screenshot contains only gibberish from the customer (`dslv,ed,ve`, `ce,fe,v,,r,v`) — yet it's labeled `استفسار` (inquiry). Root cause: the classifier sees the AI's helpful reply ("هلا حياك الله 👋 أنا مساعد متجر…هل تبحث عن منتج…") which contains the word `تبحث` / question marks, and is mis-weighting agent text as customer intent. The dominant-intent + strict-`other` rules are present but the model is still pulling intent from the assistant turn.

## Fix

Edit only `supabase/functions/classify-conversation/index.ts`:

1. **User-only intent rule (new, top of guidance)** — Explicitly instruct: *"Intent is determined EXCLUSIVELY from lines prefixed `USER:` / `CUSTOMER:`. NEVER infer intent from `ASSISTANT:` / `AI:` / `AGENT:` / `BOT:` lines — those are replies, not customer intent. If you remove every non-user line and nothing meaningful remains, the category is `other`."*

2. **Pre-filter the transcript before sending to the model** — Build a second `customerOnly` string containing only `USER:`/`CUSTOMER:` lines, and include it in the prompt as a separate block labeled `CUSTOMER_MESSAGES_ONLY:` so the model has an unambiguous signal. Keep the full transcript too (for `close_reason` / `subject` context).

3. **Deterministic gibberish guard (no model needed)** — Before calling OpenAI, normalize each customer message: strip punctuation/emojis/whitespace; if EVERY customer message is either (a) <3 letters, (b) has no valid Arabic or Latin word (no vowel/consonant pattern, e.g. `dslv,ed,ve`, `ce,fe,v,,r,v`, `ىؤتيراهاالر`), or (c) matches the existing trivial-greeting list, short-circuit and write `category: 'other'`, `intent_type: 'inquiry'`, `subject: 'محادثة بدون محتوى'`, `completion_score: 0`, `goal_met: false`. Skip the OpenAI call entirely. Use a small heuristic: a "real word" requires ≥3 chars and contains at least one Arabic letter sequence of length ≥3 OR a Latin token matching `/^[a-z]{3,}$/i` that isn't a random consonant cluster (≥1 vowel `[aeiouAEIOU]`).

4. **Add Example 19** showing the exact case from the screenshot:
   ```
   CUSTOMER: dslv,ed,ve
   CUSTOMER: ce,fe,v,,r,v
   → category: other, intent_type: inquiry
   (Random keystrokes only — ignore the assistant's helpful reply.)
   ```

5. **Strengthen the system prompt's opening line**: *"You analyze customer-support chat transcripts. ONLY the customer's own words determine the category. The assistant's replies are context for `subject`/`close_reason` only."*

## Out of scope

- No DB migration, no backfill of past mis-classified rows.
- No UI changes (`other` → `أخرى` already renders).
- User can re-analyze the conversation from the UI to verify.

## Verification

Re-analyze the screenshot conversation → expect chip to flip from `استفسار` to `أخرى`. Re-analyze a normal inquiry → still `استفسار`. Greeting + real question → still classified by the real question.
