# Fix the ticket flow (live)

Goal: when the customer taps X → "Create ticket" and submits the phone form, a complete ticket appears on `/dashboard/tickets` with code `TKT-{n}`, phone, category, and the linked conversation closes + gets classified. No new buttons added.

## 1. Database — make tickets and classification self-healing

Single migration:

- **Re-create classification trigger** (currently missing):
  ```
  CREATE TRIGGER trg_notify_classify_conversation
  AFTER UPDATE ON public.conversations_main
  FOR EACH ROW EXECUTE FUNCTION public.notify_classify_conversation();
  ```
- **New trigger on `tickets_main` BEFORE INSERT**:
  - set `display_code = 'TKT-' || number` if null
  - if `category` null and `conversation_id` set → copy `conversations_main.category`
  - if `customer_phone` / `customer_name` null and conversation has them → copy
  - assign random `customer_avatar_color` if null
- **Backfill** existing rows: `display_code` for all tickets where null; copy category/phone from linked conversation.
- **Fix ticket #328** specifically (set phone, display_code, category from its linked conversation).

## 2. Edge function `widget-events` — make it the single source of truth

Currently only `subject` is reliably persisted. Update `ticket.created` handler:

- Require a real UUID `conversation_id`; if missing/local, return 400 so the widget falls back to creating a conversation first.
- Insert `tickets_main` with `subject`, `description`, `customer_phone`, `customer_name`, `customer_id`, `conversation_id`, `tenant_id` (rest filled by trigger).
- After insert, UPDATE conversation: `status='closed'`, `ticket_status='open'`, `close_reason='customer_manual'`, `resolved_at=now()`, `subject` if empty (this fires the classify trigger).
- Insert `tickets_activities` row (status=created).
- Return `{ ticket_id, number, display_code }`.

Deploy `widget-events` and `classify-conversation`.

## 3. Widget (`public/widget.js`) — call the right endpoint, no fakes

- Remove any client-side direct REST insert into `tickets_main`. The ONLY ticket creation path is `POST /widget-events` with `event:'ticket.created'`.
- Before posting, ensure `conversation_id` is a backend UUID:
  - if still local `conv_…`, send a single silent `chat-ai` ping with the customer-form context to mint a UUID, then use it.
- On success, show the success screen with the returned `display_code` (e.g. `TKT-329`), then `fullClose()` and clear `localStorage.fuqah_conversation_id` so refresh starts fresh (already done in 3.5.0 — keep).
- The X-button → modal → "Create ticket" flow stays the only manual entry. No new header button.

## 4. Form/flag UI in `CreateTicketForm` — design fix

- Replace the `flex:1; min-height:24px` spacer with a fixed `height:12px` gap so the submit button sits directly under the phone input.
- `CountryFlag`: keep inline SVG fallback for SA/AE/EG/KW/QA/BH/OM/JO/IQ — no green box.
- Tighten select+input spacing (`gap:8px`), button full-width below.

## 5. Dashboard `TicketsPage` — show the data that now exists

- Select `display_code, category, customer_phone, customer_name, customer_avatar_color, conversations_main(category, completion_score, intent_type, goal_met)` from `tickets_main`.
- Render `display_code` (fallback `TKT-{number}`) instead of raw UUID.
- Use `ticket.category ?? conversation.category` for the category badge.
- Keep existing completion-score / intent / goal-met badges visible on each card.

## 6. Validation checklist (manual, after deploy)

```
[ ] Open widget → send 1 message → tap X → "Create ticket"
[ ] Enter phone → submit → success screen shows TKT-{n}
[ ] Refresh page → widget opens empty (no restore)
[ ] /dashboard/tickets shows new ticket: TKT-{n}, phone, category badge
[ ] /dashboard/conversations shows linked conv as Closed + ticket_status=open
[ ] Conversation has completion_score, intent_type, goal_met populated
```

## Technical notes

- No schema columns added — only triggers + backfill.
- Edge fn keeps the existing `resolveTenant` path; no auth change.
- `chat-ai` is unchanged — we only call it once if we still need a UUID.
- `widget.js` v bumped to 3.6.0.
- Files touched: 1 SQL migration, `supabase/functions/widget-events/index.ts`, `public/widget.js`, `widget/src/app/components/CreateTicketForm.tsx`, `widget/src/app/components/CountryFlag.tsx`, `src/app/components/TicketsPage.tsx`.
