# Fix the classifier in `chat-ai`

The root cause from the logs: every classifier call aborts at 800ms with zero tokens spent, so the system never detects "لا شكراً" or ticket requests and falls back to `normal`. Three problems compound:

1. `gpt-5.4-nano` is not a real OpenAI model → 404 → retry with `gpt-5-nano` (a slow reasoning model) → timeout fires before first token.
2. 800ms timeout is too tight for two sequential OpenAI calls.
3. Errors are truncated to 120 chars and the usage table is never populated, so we couldn't see what was failing.

Per your answers: keep OpenAI direct, classifier-only (no keyword shortcuts), apply the other fixes.

## Changes to `supabase/functions/chat-ai/index.ts`

1. **Model**: replace `gpt-5.4-nano` / `gpt-5-nano` with **`gpt-4.1-nano`** (per OpenAI's current model list — fast, cheap, non-reasoning, JSON-mode capable, ideal for short classification). Remove the fallback model entirely since the primary one is valid. Update `MODEL_PRICING` to `gpt-4.1-nano`: `$0.10 / 1M input, $0.40 / 1M output`.

2. **Timeout**: bump `CLASSIFIER_TIMEOUT_MS` from `800` → **`3000`** ms. With `gpt-4.1-nano` typical latency is ~200–400ms, so 3s is a safe ceiling that still feels instant to the user.

3. **Confidence threshold**: lower `CLASSIFIER_MIN_CONFIDENCE` from `0.6` → **`0.5`**. The model returns 0.55–0.7 on clear-but-short Arabic phrases like "لا شكراً" and we don't want to drop those.

4. **Error logging**: when `res.ok` is false, log the full upstream body (not just first 120 chars) to `console.error` so we can see real OpenAI errors (auth, quota, bad request) in the function logs. Keep the truncated version in the returned `error` field for the DB row.

5. **Verdict logging**: also `console.log` every classifier verdict (intent, confidence, ms, tokens) so we can verify it's actually running and tune the threshold from real data.

No other behavior changes — the dual-stage flow (user-intent shortcut → n8n → reply-intent) stays exactly as it is, and the widget contract (`offer_close_done` / `offer_ticket`) is unchanged.

## How to verify after deploy

1. Open the widget, send "لا شكراً" → rating screen should appear immediately (no n8n round-trip).
2. Send "أبي تذكرة" → phone input box should appear immediately.
3. Check `ai_classifier_usage` table — should have rows with non-zero `confidence`, `prompt_tokens`, `completion_tokens`, and `cost_usd` ~ $0.00001 per call.
4. Check function logs for `user_intent` / `reply_intent` lines with real confidence values.

## Out of scope

- No widget.js changes.
- No keyword shortcut layer (you said classifier-only).
- No switch to Lovable AI Gateway (keeping `OPENAI_API_KEY` as you have it).
