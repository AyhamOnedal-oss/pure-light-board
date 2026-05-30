# Plan: Option C — n8n owns escalation decision

The updated n8n workflow you pasted already does the right thing: AI Agent uses a Structured Output Parser that emits `{ reply, next_action, next_action_reason, attempt_state, consecutive_failures }`. The remaining work is in `chat-ai`.

## n8n side — small fixes only

1. **Wrap the response.** Today `Respond to Webhook1` uses `allIncomingItems`, which returns an array. `chat-ai` expects an object with a `reply` field. Set the node to **Respond With → JSON**, body:
  ```
   ={{ $json.output }}
  ```
   so the webhook returns the parser's object directly: `{ reply, next_action, ... }`.
2. **Tighten the system prompt rule for `consecutive_failures`.** The agent currently has 20-turn memory but no explicit instruction to scan it. Add one line:
  > Before answering, look at    your last 5 assistant turns in memory. Count how many ended in apology or "ما عندي هذي المعلومة". That number is `consecutive_failures`. Reset to 0 the moment any tool call returns useful data.
3. **No other n8n changes.** Tools, sticky notes, model, memory all stay as is.

## `supabase/functions/chat-ai/index.ts`

1. **Delete `classifyAction()**` (lines ~59–120) and the second OpenAI call entirely.
2. **Parse the n8n envelope:**
  ```ts
   const aiData = await n8nRes.json().catch(() => ({}));
   const reply = aiData.reply ?? aiData.message ?? aiData.text ?? aiData.output ?? "";
   const nextAction = aiData.next_action;          // "offer_ticket" | "offer_close" | "none"
   const nextActionReason = aiData.next_action_reason ?? "";
   const attemptState = aiData.attempt_state;
   const consecutiveFailures = Number(aiData.consecutive_failures ?? 0);
  ```
   If `aiData` is a bare string or missing `reply`, fall back to `{ reply: rawText, next_action: "none" }`.
3. **Map to existing action shape consumed by widget:**
  ```ts
   let action: { type: "offer_ticket" | "offer_close" | "offer_close_done" | "none"; reason?: string } =
     { type: nextAction === "offer_ticket" || nextAction === "offer_close" ? nextAction : "none",
       reason: nextActionReason };
  ```
4. **Keep the v4.7.9 `offer_close_done` short-circuit** (user said "لا/no" after a previous close offer). It's deterministic and free.
5. **Keep the anti-loop guard:** if `nextAction === "offer_ticket"` and the previous AI turn already offered a ticket, downgrade to `none` (prevents repeat asks). Same for `offer_close`. This is the only post-processing we keep.
6. **Log** `next_action`, `next_action_reason`, `consecutive_failures`, `attempt_state` for observability — replaces today's classifier log.

## Widget

No changes. `chatApi.ts` already reads `action.type`.

## Cost / latency

- One LLM call per turn (was two). ~35% cheaper, ~600–900ms faster.
- Token overhead from the structured envelope is ~30 output tokens — negligible.

## Validation

1. Re-import the n8n workflow with the `Respond to Webhook` fix.
2. `supabase--curl_edge_functions /chat-ai` test cases:
  - `"وين طلبي"` turn 1 → expect normal reply, `action.type === "none"`.
  - Two unanswerable turns in a row → expect `offer_ticket` on the 3rd, with `consecutive_failures >= 2` in logs.
  - `"ابغى اكلم موظف"` → immediate `offer_ticket`.
  - Successful answer → user says "لا شكراً" → `offer_close_done`.
3. Tail `chat-ai` logs to confirm `next_action_reason` looks sensible.

## Out of scope

- Widget UI, ticket creation flow, classify-conversation function.
- Any regex or keyword matching (explicitly rejected).