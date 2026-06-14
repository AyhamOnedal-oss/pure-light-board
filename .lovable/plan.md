## Goal

Make the "تم استلام تذكرتك" email show a meaningful AI-generated title and one-line scenario description, and clean up the contact line.

## Problems today

1. **العنوان** is hardcoded to `"تذكرة من المحادثة"` (or fallback `"تذكرة جديدة من المحادثة"`) at ticket-insert time in `widget-events`. The AI classifier later sets `conversations_main.subject` but never touches `tickets_main.subject`.
2. **الوصف** ends up as `[object Object]` because no real description text is ever passed through `postTicket` — the field is empty/object and renders badly. There is no AI-generated description for the ticket.
3. The contact box reads `📞 تواصل مع عميلك Storefront visitor عبر واتساب: ...` because the template injects `customer_name` ("Storefront visitor" is the default for widget-originated tickets).
4. The email fires on the AFTER INSERT trigger of `tickets_main`, **before** any AI classification runs, so even if classify wrote a better subject/description, the email would already be gone with placeholders.

## Plan

### 1. Email template (`supabase/functions/_shared/email-templates-ar.ts`)
- In `ticketReceivedHtml`, change the contact line to drop the customer name:
  ```
  📞 تواصل مع عميلك عبر واتساب: ${customer_phone}
  ```
- Remove `customer_name` from the template's parameter type (and stop passing it from `send-ticket-received`).

### 2. AI classifier (`supabase/functions/classify-conversation/index.ts`)
- Extend the JSON shape returned by the model with two new fields:
  - `ticket_title` — short Arabic label (≤ 60 chars). Examples: `"طلب رفع تذكرة"`, `"شكوى في تأخر الشحن"`, `"استفسار عن سياسة الإرجاع"`. Picked from the conversation intent.
  - `ticket_description` — one sentence (≤ 180 chars) in Arabic describing what happened: customer's situation + outcome (e.g. "العميل يشتكي من عدم وصول طلبه بعد ١٠ أيام ويطلب التحدث مع موظف بشري.").
- Update prompt + examples + parsing/validation.
- When a linked ticket exists for the conversation, also write `subject = ticket_title` and `description = ticket_description` on `tickets_main` in the same update that currently sets `priority` and `category`.

### 3. Delay the ticket email until after classification

Currently `notify_ticket_received` (AFTER INSERT trigger on `tickets_main`) fires `send-ticket-received` immediately. We instead want the email to go out **after** classify has filled in title/description.

New migration:
- Drop the AFTER INSERT trigger `notify_ticket_received` on `tickets_main`.
- Add an AFTER UPDATE trigger on `tickets_main` that fires `send-ticket-received` exactly once per ticket, when both `subject` and `description` first become non-null/non-placeholder (use a new boolean column `email_sent_at timestamptz` or simply a guard `OLD.description IS NULL AND NEW.description IS NOT NULL`). Store `email_sent_at` to make it idempotent.
- Keep the same `_app_secrets` URL + secret + `pg_net` call already used.

### 4. Widget ticket-insert path (`supabase/functions/widget-events/index.ts`)
- Insert the ticket with `subject = null` and `description = null` (instead of the hardcoded `"تذكرة من المحادثة"` / `[object Object]`). The new UPDATE-based email trigger won't fire yet.
- After insert + conversation close, classification runs (already triggered by the conversation-close path). When classify writes `subject` + `description` to `tickets_main`, the new UPDATE trigger fires the email with real AI content.

### 5. Fallback / safety
- If classify fails or is unavailable, schedule a fallback: a small pg_cron job (or a `setTimeout`-style retry in `widget-events` via `pg_net`) sets a generic title + description on tickets that have been waiting > 60 seconds with NULL subject, so the email still goes out (with safe defaults: `subject = "طلب رفع تذكرة من المحادثة"`, `description = "تم استلام طلب جديد من محادثة الويدجت."`). This avoids "silent ticket, no email".

## Technical notes (for the dev reading later)

- `send-ticket-received` already receives `customer_name` from the ticket row; we just stop using it in the template. No need to drop the DB column.
- The current AFTER INSERT trigger lives in migration `20260607020303_…`. We won't edit it; the new migration will `DROP TRIGGER … ON public.tickets_main` and `CREATE TRIGGER … AFTER UPDATE …`.
- `tickets_main` already has `subject text` and `description text`; no schema change needed there. Only add `email_sent_at timestamptz` for idempotency.
- The classify prompt change must keep all existing fields (`category`, `intent_type`, `subject`, `close_reason`, `completion_score`, `goal_met`, `priority`, `unanswered_question`) and ADD `ticket_title` + `ticket_description`. Old `subject` keeps its meaning for `conversations_main`.

## Out of scope

- No UI changes in the dashboard or widget.
- No changes to other email templates.
- Status-update / escalation emails are untouched.
