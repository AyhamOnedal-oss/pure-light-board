# Smart Escalation & Closure — handled in `chat-ai`

Move the decision logic out of n8n and into the `chat-ai` edge function. n8n keeps answering questions; `chat-ai` decides whether to attach an escalation/closure flag to the response. The widget only renders.

## Flow

```text
widget ──► chat-ai ──► n8n (reply)
                │
                └──► OpenAI classifier (gpt-4o-mini) ──► action flag
                                                          │
widget ◄──── { reply, attachments, action } ◄─────────────┘
```

After n8n returns the normal `reply`, `chat-ai` runs a tiny second OpenAI call (using the already-configured `OPENAI_API_KEY`) that inspects the last ~6 turns plus the new reply and outputs strict JSON:

```json
{ "type": "offer_ticket" | "offer_close" | "none", "reason": "short" }
```

Trigger rules baked into the classifier prompt (Arabic + English aware):
- `offer_ticket` — user explicitly asks for human / موظف / تذكرة, OR the assistant has failed to answer the same intent across the last 2–3 turns, OR question is clearly out of scope.
- `offer_close` — last user message is a thank-you / satisfaction signal ("شكراً", "تمام", "خلاص") and no open question remains.
- `none` — otherwise.

If the classifier call fails or returns invalid JSON, default to `none` (never block the reply).

## chat-ai response contract

```json
{
  "reply": "…",
  "attachments": [...],
  "action": { "type": "offer_ticket" | "offer_close" | "none", "reason": "…" },
  "tenant_id": "…",
  "conversation_id": "…"
}
```

When `action.type === "offer_ticket"` and the classifier didn't already phrase it, `chat-ai` overrides `reply` with: **"هل ترغب أن يتواصل معك أحد موظفي خدمة العملاء؟"**
When `action.type === "offer_close"`, it overrides `reply` with: **"هل تحتاج أي مساعدة أخرى؟"**
(Original n8n reply is preserved in logs for debugging.)

## Widget behavior

`widget/src/app/components/ChatWidget.tsx` `handleSendMessage` branches on `action.type`:

- `offer_ticket` → append the AI text bubble, then append a second message with `type: 'ticket-form'` that renders **`ChatInlineTicketForm`** directly under the bubble (the phone+country box the user is asking for — reuses existing component). On submit, mark `ticketFormSubmitted`, then `setCurrentScreen('ticket-created')`.
- `offer_close` → append the AI text bubble plus quick-reply chips `نعم` / `لا`.
  - `لا` → `setCurrentScreen('rating')`.
  - `نعم` → send "نعم" as a normal user turn and continue.
- `none` / missing → normal render.

Quick-reply chips: small new themed component `QuickReplies.tsx` rendered by `ChatMessage` when `message.quickReplies` is set.

## Files to change

- `supabase/functions/chat-ai/index.ts`
  After receiving `aiData` from n8n, call a new helper `classifyAction(history, lastUserMessage, reply)` that hits OpenAI Chat Completions with `response_format: { type: "json_object" }`. Wrap in try/catch with a 4s timeout — on failure return `{ type: "none" }`. Apply `reply` override for `offer_ticket` / `offer_close`. Include `action` in the JSON response. Persist the (possibly overridden) `reply` as today.

- `widget/src/app/utils/chatApi.ts`
  Extend `SendMessageResult` with `action?: { type: 'offer_ticket' | 'offer_close' | 'none'; reason?: string }` and surface it from the JSON body.

- `widget/src/app/components/ChatWidget.tsx`
  Extend `Message` with optional `quickReplies?: { label: string; value: 'yes' | 'no' }[]`. Branch on `action.type` after the assistant message is appended. Wire chip handlers (`onPickYes`, `onPickNo`) and inline-form submit (already supported via `type: 'ticket-form'`).

- `widget/src/app/components/ChatMessage.tsx`
  Render `<QuickReplies>` under assistant bubbles when `message.quickReplies` is set. Keep existing `ticket-form` path unchanged.

- `widget/src/app/components/QuickReplies.tsx` (new)
  Two themed pill buttons (نعم / لا) calling `onPick(value)`.

- `docs/n8n/README.md`
  One short note: classification now lives in `chat-ai`; n8n only needs to return `reply` (and optional `attachments`). No workflow change required.

## What is not changed

- No DB migrations, no new edge functions, no new secrets (uses existing `OPENAI_API_KEY`).
- n8n workflow stays as-is.
- Existing manual X-button → confirm modal → ticket/rating fallback remains.

## Validation

1. Three vague/unanswered turns → `action.type=offer_ticket` → phone box renders under the AI bubble → submit → ticket-created screen.
2. User sends "شكراً" → `action.type=offer_close` → نعم/لا chips render → tap لا → rating screen.
3. Normal Q&A → no chips, no form, unchanged.
4. Force OpenAI failure (bad key) → reply still delivered, `action.type=none`.