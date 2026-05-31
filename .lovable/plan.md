# Smart end + smart ticket via strict intent envelope

## Why the current build breaks (root cause)

1. The n8n AI agent answered `"عطني رقم جوالك..."` as plain text in `reply` instead of emitting `next_action: "offer_ticket"` and letting the widget render its native phone-input box.
2. The user typed the phone → it went as a normal chat turn to n8n → the Structured Output Parser failed on free-form numeric text → n8n returned non-2xx → widget showed `"عذراً، حدث خطأ مؤقت"`.
3. Same pattern for closing: the agent writes goodbye text instead of emitting `offer_close`, so the rating screen never fires.

The bug is not in `chat-ai` or the widget. The n8n agent is doing UI work in text instead of delegating to the widget through a strict envelope.

## Chosen approach

Strict intent envelope. The AI agent has exactly **two responsibilities**:
- Write a short conversational `reply`.
- Pick `next_action` from a fixed enum: `"none" | "offer_ticket" | "offer_close"`.

The widget owns every UI affordance. Phone numbers never reach n8n.

Per your answers:
- **Flow A (close)**: short "يعطيك العافية" message → widget jumps **directly** to RatingScreen (no نعم/لا confirmation).
- **Flow B (ticket)**: phone goes directly to `/tickets`; n8n never sees it. After "تم إنشاء التذكرة #..." success card, widget **auto-transitions to RatingScreen** so the user can rate the AI's handling of the escalation.

## How the new conversation flows

### Flow A — smart close (auto-rating)
```
user: "تمام يعطيك العافية"
  → n8n emits { reply: "في خدمتك 🌷", next_action: "offer_close" }
  → widget renders the reply
  → ~1.2s later: closeConversation(reason='ai_request') + setCurrentScreen('rating')
  → no نعم/لا
```

### Flow B — smart escalation to ticket (with rating after)
```
user can't be helped (2 consecutive tool failures OR explicit "أبغى أكلم بشري")
  → n8n emits { reply: "خل أرفع لك تذكرة دعم 🌷", next_action: "offer_ticket" }
  → widget renders reply + inline phone-input box
  → user types phone → widget POSTs straight to /widget-events (event: ticket.created)
    (n8n is NOT called this turn — no parser failure, no عذراً)
  → widget shows TicketCreatedScreen ("تم إنشاء التذكرة #TKT-123")
  → after ~2s (or on user tap "تم"), widget auto-transitions to RatingScreen
    so the user rates the AI's handling of the handoff
  → rating submit → conversation already closed by widget-events ticket.created handler
```

### Flow C — guard against premature endings
- If `offer_close` arrives but the user's last 2 turns contain unresolved questions → `chat-ai` downgrades to `none`.
- If `offer_ticket` was already shown and form is still open → downgrade duplicate to `none`.

## Technical changes

### 1. `supabase/functions/chat-ai/index.ts`
- **Tolerant parser**: if n8n returns 200 with invalid JSON, treat raw text as `{ reply: rawText, action: { type: "none" } }`. Kills the عذراً from screenshot.
- **Soft 5xx fallback**: on n8n error, return `{ reply: "لحظة من فضلك… حصل خلل بسيط 🌷", action: { type: "none" } }` with HTTP 200.
- Anti-loop guards: dedupe consecutive `offer_ticket` / `offer_close`.
- Pass `last_assistant_action` and `consecutive_tool_failures` to n8n in webhook body.

### 2. n8n workflow — system prompt + Respond node
Strict JSON system prompt (Arabic) forbidding the AI from ever requesting a phone or asking "هل تحتاج مساعدة أخرى؟" in `reply`. Only `next_action` triggers UI.
- `offer_ticket` when: user requested human OR `consecutive_tool_failures >= 2`.
- `offer_close` when: user thanked/said goodbye with no new question, OR 2 productive replies with no follow-up.
- Otherwise `none`.

Respond to Webhook node → "Respond With: JSON", body `={{ $json.output }}`.

### 3. Widget (`widget/src/app/components/ChatWindow.tsx`)
- **Remove regex fallbacks** (`isTicketOfferPrompt`, `isCloseOfferPrompt`). Widget reacts only to `action.type`.
- **`offer_close` handler**: render reply → after ~1.2s call `closeConversation(reason='ai_request')` and `setCurrentScreen('rating')`. No confirmation chips.
- **`offer_ticket` handler**: render reply + inline phone form (existing `ChatInlineTicketForm`).
- **TicketCreatedScreen → Rating bridge** *(new per your feedback)*: after the ticket-created success card is shown for ~2s (or on user tap "تم"), call `setCurrentScreen('rating')`. The conversation is already closed by `widget-events` on `ticket.created`, so the rating just needs the existing conversation id. RatingScreen's "تخطي وإغلاق" still works the same.

### 4. No DB migration needed.

## Files touched

- `supabase/functions/chat-ai/index.ts` — tolerant parser, soft 5xx fallback, pass action/failure context to n8n.
- `widget/src/app/components/ChatWindow.tsx` — drop regex fallbacks; `offer_close` → auto-rating; after `TicketCreatedScreen` → auto-rating.
- `widget/src/app/components/TicketCreatedScreen.tsx` (light edit) — add `onContinueToRating?: () => void` and auto-fire it after a short delay; primary CTA becomes "تقييم التجربة".
- n8n workflow — system prompt rewrite + Respond node returns `$json.output` as JSON. (Patch text provided for you to paste in n8n.)

## Why this fixes everything

| Issue | Cause | Fix |
|---|---|---|
| Phone shown as text instead of box | Agent wrote UI in `reply` | Prompt forbids it; widget renders box on `offer_ticket` |
| عذراً after typing phone | Parser failed on numeric reply | Phone bypasses n8n entirely; tolerant parser as safety net |
| Box not always showing | Widget guessed from Arabic regex | Only `action.type` triggers UI |
| No auto-rating after thanks | Agent only said goodbye in text | `offer_close` → auto-rating |
| No rating after ticket created | Flow stopped at TicketCreatedScreen | Auto-transition to RatingScreen after success card |
