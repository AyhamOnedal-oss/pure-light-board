## Issues to fix

### 1. Slow save (5–7s) and no idempotency
**Cause:** The edge function paginates `auth.admin.listUsers` up to 5×1000 users to find the email — that's the bulk of the latency. Plus the "حفظ" button has no `disabled` / loading state, so multiple clicks each fire a fresh edge-function call.

**Fix:**
- Replace the listUsers loop with a single direct lookup: query `auth.users` via `admin.auth.admin.getUserByEmail` (or a service-role SQL `select id from auth.users where email = ?`). Eliminates the multi-second scan.
- In `TeamPage.tsx`, add `isSaving` state. While `handleAdd` / `handleEdit` / `resendInvite` are in-flight, set `disabled` on the Save button, show "جارٍ الحفظ…", and early-return if already saving. This is true client-side idempotency for the click.
- (Optional hardening) Also dedupe on the server: if a `team_members` row for `(tenant_id, email)` already exists with `status='active'` and was created in the last few seconds, skip re-sending the email.

### 2. "تم إضافة العضو — فشل إرسال الإيميل"
**Cause:** The edge function inserts the member first, then calls Resend. When Resend returns non-2xx, `email_sent` is false and the UI shows that exact message. The likely current Resend rejection is the sandbox-domain restriction (the earlier 403 about `onboarding@resend.dev`) — even though `RESEND_FROM_EMAIL` was updated to `support@fuqah.net`, the deployed function may still be using the old default, or the value still contains the sandbox address.

**Fix:**
- Verify `RESEND_FROM_EMAIL` is set to `Fuqah AI <support@fuqah.net>` (verified `fuqah.net` domain).
- Redeploy `invite-employee` so it picks up the secret cleanly.
- Surface Resend's real error to the toast (already returned as `email_error`) so future failures are diagnosable instead of generic.
- Trigger a fresh send and confirm `email_sent: true` in the response.

### 3. Phone number only supports +966
**Cause:** UI hard-codes the `+966` prefix, validates with `/^5\d{8}$/`, and `formatPhone` re-prepends `+966`.

**Fix:**
- Add `libphonenumber-js` (already-common, lightweight) for parsing/validation/formatting.
- Replace the static `+966` prefix with a country selector (flag + dial code). Default to SA but allow any country.
- Store phone in **E.164** (e.g. `+9665XXXXXXXX`) in the DB. Validate with `isValidPhoneNumber`. Display with `formatInternational`.
- Update `formatPhone` in the table to just render the stored E.164 (or its international format) instead of prepending `+966`.
- Migrate existing rows: any phone that starts with `5` and is 9 digits gets `+966` prepended on read (one-time backfill or read-time normalization).

## Technical notes
- Files touched: `supabase/functions/invite-employee/index.ts` (lookup + better error return), `src/app/components/TeamPage.tsx` (saving state, country selector, phone validation/format), plus install `libphonenumber-js`.
- No DB schema change required; `team_members.phone` stays `text` and stores E.164.
- After edge-function edit, it auto-deploys.

## Out of scope
- No changes to the email template itself.
- No changes to permissions logic.
