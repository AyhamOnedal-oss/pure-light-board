# Plan: Smart intent classifier in `chat-ai` (GPT-5.4-nano + cost tracking)

Goal: stop relying on n8n's broken `next_action` and brittle Arabic regex. After every AI reply, run a tiny OpenAI call with **`gpt-5.4-nano`** to classify intent, return a clean `action` to the widget, and log token usage + cost so it can surface in the admin dashboard later.

## Model

- Provider: **OpenAI direct** (using existing `OPENAI_API_KEY` secret — no new secrets).
- Model: **`gpt-5.4-nano`** — cheapest, fastest GPT-5.4 variant, strong instruction-following for short classification. Falls back to `gpt-5-nano` if `gpt-5.4-nano` returns 404 (defensive; the API name may differ between accounts).
- Endpoint: `POST https://api.openai.com/v1/chat/completions` with `response_format: { type: "json_object" }`.
- Hard timeout: 800 ms via `AbortController`. On timeout/error → fall back to existing regex result.

## Classifier contract

System prompt (Arabic + English aware, ~6 lines):
- `offer_ticket` → reply is offering/suggesting to connect the customer with a human/customer-service agent or raise a ticket.
- `offer_close` → reply is wrapping up and asking if the user needs anything else.
- `continue` → anything else (normal answer, info, clarification).

Required JSON output:
```json
{ "intent": "offer_ticket" | "offer_close" | "continue", "confidence": 0.0-1.0 }
```

Act only when `confidence >= 0.6`, else `continue`.

## Where it goes

`supabase/functions/chat-ai/index.ts`:
1. New helper `classifyIntent(reply, lastUserMessage)` → returns `{ intent, confidence, usage, ms }`.
2. New helper `estimateCost(model, promptTokens, completionTokens)` → returns USD.
3. Call it after we have `reply` from n8n, before building `action`.

## Decision flow

```
reply = n8n reply
hardClose short-circuit (unchanged)  ──► offer_close_done
else if regexTicket(reply) → action = offer_ticket   (free, instant)
else if regexClose(reply)  → action = offer_close
else:
    verdict = await classifyIntent(reply, message)   // ~$0.0000X, 800ms cap
    if verdict.confidence >= 0.6 and verdict.intent != "continue":
        action = { type: verdict.intent, reason: "classifier" }
apply anti-loop guard (existing)
```

`env.next_action` from n8n is logged for comparison but no longer trusted.

## Cost tracking (for admin dashboard later)

Pricing constants in chat-ai (USD per 1M tokens, easy to update):
```
gpt-5.4-nano: input $0.05, output $0.40   // placeholder — verify on first run
gpt-5-nano:   input $0.05, output $0.40
```

Compute per call:
```
cost_usd = promptTokens / 1e6 * inputRate + completionTokens / 1e6 * outputRate
```

### New DB table — migration

```sql
CREATE TABLE public.ai_classifier_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  conversation_id uuid,
  model        text NOT NULL,
  intent       text NOT NULL,           -- offer_ticket | offer_close | continue
  confidence   numeric(4,3) NOT NULL,
  source       text NOT NULL,           -- 'classifier' | 'regex' | 'anti_loop' | 'fallback'
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  cost_usd     numeric(10,8) NOT NULL DEFAULT 0,
  latency_ms   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_classifier_usage TO authenticated;
GRANT ALL    ON public.ai_classifier_usage TO service_role;

ALTER TABLE public.ai_classifier_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read classifier usage"
ON public.ai_classifier_usage
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE INDEX ai_classifier_usage_tenant_day_idx
  ON public.ai_classifier_usage (tenant_id, created_at DESC);
```

Insert one row per AI reply (best-effort, non-blocking). Regex/anti-loop hits also insert a row with `prompt_tokens = 0`, `cost_usd = 0` so the admin dashboard can later show: total classifier calls, % handled free by regex, total spend, intent distribution.

## Logging

One structured log line per reply:
```
classifier { intent, confidence, source, model, prompt_tokens, completion_tokens, cost_usd, ms, regex_hit, n8n_next_action }
```
Verifiable via `supabase--edge_function_logs`.

## Widget

No changes. `chatApi.ts` already passes `action` through; `ChatWindow.tsx` already opens phone box on `offer_ticket` and rating on `offer_close`. The existing Hostinger bundle keeps working — it just starts getting correct actions.

## Out of scope (separate task later)

- Admin dashboard UI to visualize `ai_classifier_usage` (charts: spend/day, intent mix, regex hit-rate).
- n8n workflow changes.
- Rotating `OPENAI_API_KEY`.

## Files touched

- `supabase/functions/chat-ai/index.ts` — add `classifyIntent`, `estimateCost`, usage insert, swap regex-only decision for hybrid.
- `supabase/migrations/<timestamp>_ai_classifier_usage.sql` — new table + RLS + grants + index.
