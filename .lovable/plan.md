## Root cause (from `widget-events` edge log)

```
ticket insert failed: null value in column "subject" of relation "tickets_main" violates not-null constraint
```

Last round we changed `widget-events` to insert `subject: null` / `description: null` so the new AFTER UPDATE trigger could fire once classify wrote real values. But `tickets_main.subject` (and likely `description`) is still `NOT NULL`, so the insert is rejected. Result chain:

- Widget shows "تعذّر إنشاء التذكرة".
- No ticket row → AFTER INSERT/UPDATE triggers never fire → no `send-ticket-received` call → no email (matches the empty `send-ticket-received` logs).
- Classify never gets a ticket to attach subject/description to, and `conversations_main.category` (تصنيف) only gets written when classify finishes — if OpenAI fails or the conversation never closes cleanly, تصنيف stays empty.

## Plan

### 1. DB migration

- `ALTER TABLE public.tickets_main ALTER COLUMN subject DROP NOT NULL;`
- `ALTER TABLE public.tickets_main ALTER COLUMN description DROP NOT NULL;` (only if it's also NOT NULL — check first).
- Re-confirm the previous migration is in place: `email_sent_at` column, AFTER UPDATE `notify_ticket_received`, AFTER INSERT `notify_ticket_received_insert`, and the `pg_cron` job calling `tickets_fill_pending_email_fallback()` every minute. If the cron job is missing, schedule it here.
- Read-only sanity check on `_app_secrets` for `ticket_email_webhook_url` / `ticket_email_webhook_secret` / `classify_webhook_url` / `classify_webhook_secret` and surface any missing keys in the migration summary.

### 2. Classify fallback (so تصنيف is always set)

Edit `supabase/functions/classify-conversation/index.ts` so every error path (OpenAI unreachable, non-2xx, invalid JSON) still writes a safe fallback to `conversations_main` and the linked ticket instead of just returning an error:

- `conversations_main`: `category = 'other'`, `intent_type = 'inquiry'`, `subject = 'محادثة من الويدجت'`, `analysis_done = true`.
- `tickets_main` (if linked): `subject = 'طلب رفع تذكرة من المحادثة'`, `description = 'تم استلام طلب جديد من محادثة الويدجت.'` so the AFTER UPDATE trigger fires the email.

Keep returning the error code in the HTTP response for observability, but never leave a conversation un-classified or a ticket without subject/description.

### 3. Widget code — no further change

Once the NOT NULL constraint is dropped, the existing `subject: null` insert in `widget-events` succeeds. AFTER INSERT no-ops; classify (or the 60s `pg_cron` fallback) populates subject/description; AFTER UPDATE trigger fires `send-ticket-received` exactly once (guarded by `email_sent_at`).

### 4. Verification after deploy

1. Open widget → "ارفعلي تذكرة" → confirm phone → widget shows success (no red error).
2. `select id, subject, description, email_sent_at, created_at from tickets_main order by created_at desc limit 3` — subject/description populated within ~60s, `email_sent_at` set.
3. `send-ticket-received` edge logs show one POST per ticket, status 200.
4. `select category, subject, analysis_done from conversations_main order by created_at desc limit 3` — تصنيف populated even on classify failures.
5. `select status, error_message, created_at from email_send_log where template_name like '%ticket%' order by created_at desc limit 10` — confirms `sent`; surface any `dlq`/`failed` reason.

## Out of scope

- No UI/template changes (template was already fixed).
- No other email flows touched.
