
## Goal
n8n returns only message text. The `chat-ai` Supabase edge function is the single brain: it gets n8n's reply, classifies the exchange using **OpenAI `gpt-4o-mini` directly** (not Lovable AI), and returns to the widget what to do. Widget does zero text detection.

## chat-ai response contract
```json
{ "reply": "string", "intent": "continue" | "offer_ticket" | "closed" }
```

## chat-ai edge function (`supabase/functions/chat-ai/index.ts`)
1. Receive user message + conversation history as today.
2. Call n8n webhook (existing logic), extract `output` → `reply`.
3. Call OpenAI directly:
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Auth: `Authorization: Bearer ${Deno.env.get("OPENAI_API_KEY")}`
   - Model: `gpt-4o-mini`
   - `response_format: { type: "json_object" }`
   - System prompt (Arabic + English aware) instructs it to classify the exchange into exactly one of:
     - `offer_ticket` — user explicitly asks for human/support/ticket/شكوى/تواصل معكم، OR the AI reply offers to escalate / open a ticket / connect to customer service.
     - `closed` — user clearly ended chat (لا/خلاص/كفاية/لا شكراً/no/that's all) after AI asked "هل تحتاج مساعدة أخرى؟"-style, OR AI reply is a farewell (شكراً لتواصلك، يومك سعيد، في أمان الله، goodbye…).
     - `continue` — otherwise.
   - Input to classifier: last user message, AI reply, last 4 turns of history.
4. On classifier failure/timeout: default `intent: "continue"` (never block the chat).
5. Return `{ reply, intent }` JSON with CORS headers. Remove any `action.type` / `offer_close_done` fields.

## Widget changes (`/mnt/documents/widget-4.7.16-hostinger.js`, ~150 KB)
1. Remove all client-side text detection: `isCloseOfferText`, `isCloseDoneReply`, short-negative matcher, `offer_close_done` handling, ticket-text heuristics, `window.__fqLastAction`.
2. `sendToBackend` callback now receives `{ reply, intent }`. Render the reply bubble, then branch on `intent`:
   - `continue` → nothing extra.
   - `offer_ticket` → render the existing inline phone/ticket form below the bubble.
   - `closed` → after 2s:
     - if `state.ticketCreated === true` → keep ticket-number/print card visible, disable composer with "تم إنهاء المحادثة" placeholder, **no rating**.
     - else → switch to `renderRatingScreen()` (rating restored only for the no-ticket close path).
3. Ticket creation success (`restCreateTicket`): set `state.ticketCreated = true`, immediately render the ticket-number screen with print/download + "إنهاء المحادثة" button. Do not bounce back to chat. Do not show rating.
4. Bump version header to 4.7.16.
5. Write `/mnt/documents/widget-4.7.16-hostinger.js` AND overwrite `/mnt/documents/widget.js` with the same ~150 KB Hostinger bundle. Verify byte size (~150 KB, not 400 KB) before delivering.

## Out of scope
- n8n workflow stays as-is (message text only).
- No DB schema, no React preview widget, no ticket logic changes beyond the post-create screen.

## Files touched
- `supabase/functions/chat-ai/index.ts` — n8n call + OpenAI classifier + new response shape.
- `/mnt/documents/widget-4.7.16-hostinger.js` (new).
- `/mnt/documents/widget.js` (overwritten).
