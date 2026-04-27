# Fuqah AI — Widget Integration Prompt

Hand this document to the AI building the external chat widget. It lists every endpoint, payload, and rule the widget must follow to feed the dashboard backend.

## Base URL & Auth

- Base: `https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/make-server-fc841b6e`
- Header for every request: `Authorization: Bearer <SUPABASE_ANON_KEY>`
- Content type: `application/json` unless noted (attachments use `multipart/form-data`).
- Every payload includes `storeId` (string) — identifies the tenant.

## 1. Settings & Branding (read-only for widget)

- `GET /chat-settings/:storeId` → `{ success, settings }` — primary color, position, welcome bubble (`welcomeBubbleEnabled`, `welcomeBubbleLine1` ≤24 chars, `welcomeBubbleLine2` ≤36 chars), inactivity (`inactivityEnabled`, `inactivityPromptSeconds` 30-300, `inactivityCloseSeconds` 15-180).
- `GET /store-branding/:storeId` → `{ success, branding }` — logo, icon, name, domain.

Widget MUST render welcome bubble and run the inactivity timer exactly per these fields. When `inactivityPromptSeconds` of idle elapses, show a confirmation prompt; if no interaction within `inactivityCloseSeconds`, auto-close with reason `idle`.

## 2. Widget Events

- `POST /events/bubble-shown` — `{ storeId }` — each time the launcher is rendered to a visitor.
- `POST /events/bubble-click` — `{ storeId }` — visitor clicks the launcher (before conversation opens).

## 3. Conversation Lifecycle

- `POST /conversations` — `{ storeId, visitor: { name?, phone?, email?, locale? } }` → `{ conversation: { id, ... } }`. Call when a chat session actually starts (message sent or widget opened).
- `POST /conversations/:cid/messages` — `{ storeId, role: "customer" | "ai" | "agent", text, attachments?: [fileId], aiResponseMs?: number }`. For AI messages, include `aiResponseMs` (ms from user message to AI reply) so the dashboard can compute avg response time.
- `POST /conversations/:cid/close` — `{ storeId, reason: "customer_manual" | "ai_request" | "idle", category?: "inquiry" | "complaint" | "request" | "suggestion" }`. Category is the AI's classification of the conversation.
- `POST /conversations/:cid/rate` — `{ storeId, stars: 1-5, comment? }`. Ask the visitor for a star rating after close.
- `POST /conversations/:cid/feedback` — `{ storeId, messageId, value: "up" | "down" }`. For thumbs up/down on individual AI replies.
- `POST /unknown-questions` — `{ storeId, cid, text }`. Call whenever the AI cannot answer, so the dashboard can surface gaps.

## 4. Tickets

- `POST /tickets` — `{ storeId, cid?, subject, priority?: "low"|"medium"|"high"|"urgent", category?, customer? }` → `{ ticket }`. Open when the visitor asks for human help or the AI escalates.
- `PATCH /tickets/:tid` — `{ storeId, status?: "open"|"pending"|"closed", priority?, assignee? }`.

## 5. Attachments

- `POST /attachments` — `multipart/form-data` with fields `file`, `storeId`, `cid`. Returns `{ attachment: { id, signedUrl, name, contentType, size } }`. Use the returned `id` as `attachments[]` in subsequent message payloads.
- `GET /attachments/:storeId/:fid/url` → refresh signed URL (1 hour TTL).

## 6. Dashboard (for reference, not for widget)

- `GET /overview/:storeId?month=YYYYMM&day=YYYYMMDD` — aggregated metrics (conversations, completion %, tickets by state, words consumed, bubble shown/clicks, avg response ms, categories, close reasons, ratings, thumbs, unknown questions).

## Rules

1. Never send the service role key to the widget — widget uses the anon key only.
2. Always call `bubble-shown` on first render and `bubble-click` before creating a conversation.
3. Record `aiResponseMs` for every AI message; without it, avg response time will be 0.
4. `close` must always fire (even on page unload via `navigator.sendBeacon`) with a valid `reason`.
5. Category is REQUIRED on close if the AI can classify; otherwise omit.
6. Respect welcome bubble and inactivity timer fields exactly as returned from `/chat-settings/:storeId`. If `welcomeBubbleEnabled=false`, do not render it. If `inactivityEnabled=false`, do not run the timer.
7. Clamp `welcomeBubbleLine1` to 24 chars and `welcomeBubbleLine2` to 36 chars when displaying.
8. Upload attachments before sending the message that references them.
9. Call `unknown-questions` whenever the AI produces a fallback / "I don't know" reply.
10. All timestamps are server-generated; widget should not send `createdAt`.
