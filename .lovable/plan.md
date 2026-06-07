## Goal

Wire the two new Arabic email templates from Batch 3:

- **T12 — انتهاء التجربة المجانية (Free Trial Ended)** — new template.
- **T13 — تنبيه انتهاء الباقة v2 (Subscription Expiry Warning v2)** — visual refresh of the existing warning we already send; replaces the current `subscriptionExpiryWarningHtml` markup.

Sender stays `support@fuqah.net`; footer keeps `support@fuqah.ai` / `fuqah.ai`.

## Changes

### 1. `supabase/functions/_shared/email-templates-ar.ts`
- **Add** `trialEndedHtml({ store_name, subscription_link })` — exact markup from T12: 🚀 hero, "انتهت تجربتك المجانية" headline, feature list bullets (ردود ذكية / تدريب / دعم فني), CTA "ابدأ اشتراكك الآن" linking to `subscription_link`, standard footer.
- **Replace** the body of `subscriptionExpiryWarningHtml` with the T13 v2 markup (amber gradient hero ⏰, large days-remaining card, "تجديد الآن" CTA). Signature stays `{ store_name, days_remaining, package_name, renewal_link }` so the existing caller does not change.

### 2. `supabase/functions/process-subscription-expiry/index.ts`
Add a trial-ended branch alongside the existing expired + warning logic:

- For each `settings_plans` row already loaded, also read the tenant's `settings_workspace.status`.
- If `status = 'trial'` AND `subscription_end_date <= today` AND `trial_ended_emailed_at IS NULL`:
  - Render `trialEndedHtml({ store_name, subscription_link: "https://fuqah.ai/billing" })`.
  - Subject: `انتهت تجربتك المجانية في فقاعة AI`.
  - On success, stamp `settings_plans.trial_ended_emailed_at = now()`.
- The trial branch takes precedence over the generic "expired" branch when `status='trial'`, so trial tenants get the trial-specific email instead of the paid-expiry one.
- The warning branch keeps working for trial tenants too (days_remaining 1..7), so they get a heads-up before the trial ends.

### 3. Migration — add one tracking column
New migration adds `trial_ended_emailed_at timestamptz` to `settings_plans` (idempotency flag, mirrors `expired_emailed_at`). No backfill; existing rows stay `NULL`.

No DB triggers, cron jobs, or secrets change. The daily 06:00 UTC cron that already calls `process-subscription-expiry` covers the new branch automatically.

### 4. No frontend changes
Account settings / billing UI is untouched. Templates are server-side only.

## Out of scope
- Trial duration / `subscription_end_date` provisioning for new tenants — assumed already set elsewhere (or set manually). If a trial tenant has no `subscription_end_date`, no email fires, same as today.
- Re-sending the trial-ended email after a new trial.
