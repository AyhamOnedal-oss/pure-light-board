# Plan: Switch from hybrid to pure Option 1 (always-on classifier)

Remove the regex fast-path entirely. Every AI reply runs through `gpt-5.4-nano`. Single source of truth.

## Changes to `supabase/functions/chat-ai/index.ts`

1. **Always call `classifyIntent(reply, message)`** on the current AI reply.
   ```
   verdict = await classifyIntent(reply, message)
   if verdict.ok && verdict.confidence >= 0.6 && verdict.intent !== "continue":
       decidedIntent = verdict.intent
       source = "classifier"
   else:
       decidedIntent = "none"
       source = verdict.ok ? "low_confidence" : "fallback"
   ```
2. **Anti-loop guard stays.** Drop the intent if the *previous* AI turn already offered the same thing.
3. **Keep `isTicketOfferText` and `isCloseOfferText` helpers** — only used now for two backward-looking checks:
   - `prevWasCloseOffer` → the existing hard end-of-conversation short-circuit (user replies "لا شكراً" after AI's close offer).
   - `prevWasTicketOffer` → anti-loop guard input.
   They are no longer used on the current reply.
4. **`ai_classifier_usage` insert stays.** `source` values are now `classifier`, `low_confidence`, `anti_loop`, or `fallback` (no more `regex`).
5. **Log line stays**, drop the `regex_hit` field.

## Out of scope

- No DB changes (table already created).
- No widget changes.
- n8n `next_action` is still logged-only.

## Net effect

- 1 extra OpenAI nano call on **every** AI reply (~$0.00005, 100–400 ms typical, 800 ms hard cap).
- Classifier is the only decider for `offer_ticket` / `offer_close` on the current reply.
