
## Goal

Wire the 4 Arabic templates from the uploaded file (`fuqah-email-templates.html`) as live transactional emails. Use the uploaded HTML **verbatim** (only `{{{var}}}` → real values, and normalize the few `fugah.ai` typos to `fuqah.ai`). Sender: `Fuqah AI <support@fuqah.net>`. Footer always shows `support@fuqah.ai` and `fuqah.ai` (already correct in the HTML).

## What gets built

### 1. Welcome — "تم تفعيل اشتراكك بنجاح" (Zid + Salla install, new user)

Replace `welcomeEmailHtml()` in `supabase/functions/_shared/provision-merchant.ts` with template #1 HTML. Subject: `تم تفعيل اشتراكك بنجاح`.

Placeholders → data source:
- `store_name` → `opts.storeName`
- `email` → `opts.email`
- `password` → `generatedPassword`
- `package_name` → `settings_workspace.plan` (fallback "تجريبية")
- `expires_at` → `settings_plans.period_start + 30 days` formatted ar-SA
- `conversations_count` → "غير محدود" (no per-plan column exists)
- `characters_count` → `settings_plans.monthly_word_quota * 5` formatted

Also re-theme `linkedEmailHtml` (existing-user install) with the same header/footer style so both paths feel consistent.

### 2. Ticket received — "تم استلام تذكرتك"

New edge function `supabase/functions/send-ticket-received/index.ts` (verify_jwt=false, secret-gated). Renders template #2 with values from a `tickets_main` row + tenant owner email.

Wiring via DB trigger (follows the existing `notify_classify_conversation` pattern using `pg_net` + `_app_secrets`):
- New migration: `AFTER INSERT ON tickets_main` → fires `net.http_post` to the function URL with `x-ticket-secret` header and `{tenant_id, ticket_id}`.
- Two new rows in `_app_secrets`: `ticket_email_webhook_url`, `ticket_email_webhook_secret` (secret also added to Edge Function env).

Function looks up: ticket fields, owner email (`auth.users` via service role on owner from `auth_tenant_members`), `settings_workspace.name`. Subject: `تم استلام تذكرتك #{display_code}`.

### 3. Service paused — "تم إيقاف الخدمة مؤقتًا"

New edge function `supabase/functions/send-service-paused/index.ts`. Renders template #3 (`store_name`, `renewal_link` → `https://fuqah.ai/?settings=plans`).

Wiring: extend the existing `bump_word_usage()` PL/pgSQL function — after the `UPDATE settings_plans`, detect the threshold cross (previous `monthly_words_used < monthly_word_quota` AND new value `>= monthly_word_quota`). When it crosses, fire `net.http_post` to the function (same `_app_secrets` pattern).

Add `service_paused_emailed_period date` column to `settings_plans` and set it inside the trigger to the current `period_start` so we only email **once per billing period** (auto-resets when period rolls over).

Subject: `تم إيقاف خدمة فقاعة AI مؤقتًا — اشحن رصيدك`.

### 4. Password changed — "تم تغيير كلمة المرور بنجاح"

New edge function `supabase/functions/send-password-changed/index.ts` (verify_jwt=true, uses caller's JWT to identify the user). Renders template #4 with `store_name` (display_name fallback to email local-part), `change_date`, `change_time` (Asia/Riyadh, ar-SA formatting).

Wiring in `src/app/components/settings/AccountSettings.tsx`: after the successful `supabase.auth.updateUser({ password })` call, fire-and-forget `supabase.functions.invoke('send-password-changed')`.

Subject: `تم تغيير كلمة المرور بنجاح`.

## Shared helper

Move `sendResendEmail()` from `provision-merchant.ts` into a new `supabase/functions/_shared/resend.ts` and reuse it from the 3 new functions (sender stays `Fuqah AI <support@fuqah.net>`).

## Migrations

One migration:
1. `ALTER TABLE settings_plans ADD COLUMN service_paused_emailed_period date;`
2. Rewrite `bump_word_usage()` with threshold-cross detection + `net.http_post` call.
3. Create `notify_ticket_received()` trigger function + `AFTER INSERT` trigger on `tickets_main`.
4. Insert webhook URL/secret rows into `_app_secrets`.

## Secrets to add

- `TICKET_EMAIL_WEBHOOK_SECRET`
- `SERVICE_PAUSED_WEBHOOK_SECRET`

(Both also inserted into `_app_secrets` so the triggers can pass them as headers.)

## Out of scope (left for next batch)

Emails #9–#16 from the previous inventory: trial-ended, renewal confirmation, ticket-status-updated, low-credit warning, subscription expired/nearing-expiry, platform disconnected. Those need separate HTML templates + a billing/cron source-of-truth decision that's still open.

## Files touched

- `supabase/functions/_shared/provision-merchant.ts` (replace `welcomeEmailHtml` + `linkedEmailHtml`, switch to shared helper)
- `supabase/functions/_shared/resend.ts` (new)
- `supabase/functions/send-ticket-received/index.ts` (new)
- `supabase/functions/send-service-paused/index.ts` (new)
- `supabase/functions/send-password-changed/index.ts` (new)
- `supabase/config.toml` (verify_jwt=false for ticket + service-paused)
- `supabase/migrations/<ts>_email_triggers.sql` (new)
- `src/app/components/settings/AccountSettings.tsx` (invoke after password update)
