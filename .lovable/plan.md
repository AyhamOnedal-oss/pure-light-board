# Invite Employee — Arabic RTL Welcome Email

## Goal
When an admin adds a team member on `/dashboard/team` (`TeamPage.tsx`), create the Supabase auth user, save the row in `team_members`, and email the new employee the Arabic RTL welcome template you pasted (dark navy header "مرحبًا بك في فقاعة AI!", greeting + store line, login details card with email/password/date, yellow "change password" notice, "تسجيل الدخول" CTA, fugah.ai footer).

Today `TeamPage.handleAdd` only inserts the row and shows a toast that says an email "will be sent" — nothing is actually sent. This plan wires the real send.

Note: Resend's HTTP API does not expose the templates you draft in the Resend dashboard, so we embed the same HTML inline in the edge function. The rendered email matches the template you sent.

## Scope
- One new edge function: `invite-employee`
- Wire `TeamPage.handleAdd` to call it (replaces the direct `team_members` insert so user creation + insert + email happen atomically server-side)
- Reuse existing `RESEND_API_KEY` and the verified `support@fuqah.net` sender — no new secrets, no domain changes
- No DB schema changes (existing `team_members(tenant_id, name, email, phone, permissions, status, invited_by)` is enough)

## Email rendering
- `<html lang="ar" dir="rtl">`, `body { direction: rtl; text-align: right }` so Arabic text and the details card flow right-to-left correctly.
- Email values (email + password) are inside `direction: ltr; text-align: left` boxes so the address/password render naturally inside the RTL layout (Gmail/Outlook quirk).
- Variables substituted server-side: `employee_name`, `store_name`, `email`, `password`, `add_date`, `add_time`, `loginUrl`. All values HTML-escaped.

## Edge function `supabase/functions/invite-employee/index.ts`
Request: `POST { tenant_id, name, email, phone, permissions }` with the caller's Supabase JWT in `Authorization`.

Steps:
1. CORS preflight + JWT verify via anon client `auth.getUser()`.
2. Validate input (email regex, required fields).
3. Authorize: caller must have a row in `auth_tenant_members` for the given `tenant_id` (any role).
4. Service-role admin client:
   - Look up auth user by email (paginated `auth.admin.listUsers`).
   - If missing → `auth.admin.createUser({ email, password, email_confirm: true })` with a 12-char random password.
   - If existing → `auth.admin.updateUserById(..., { password: <new> })` so the credentials in the email are valid (existing-user case is treated like a re-invite). This is the simplest correct behavior given the email must contain a working password.
5. Upsert into `team_members` keyed by `(tenant_id, email)`:
   - New row: insert with `status='active'`, `invited_by=callerId`.
   - Existing row: update name/phone/permissions/status.
6. Fetch `settings_workspace.name` for `tenant_id` to use as `store_name` (fallback `"متجرك"`).
7. Format `add_date` / `add_time` in `Asia/Riyadh` (DD/MM/YYYY, HH:mm 24h).
8. Build `loginUrl` from request `Origin` header → `${origin}/login?email=...`.
9. Send via Resend `api.resend.com/emails` from `Fuqah AI <support@fuqah.net>`, subject `مرحبًا بك في فقاعة AI — {{store_name}}`.
10. Return `{ ok, member_id, is_new_user, email_sent, email_error }`.

Errors return JSON with CORS headers: 400 invalid_input, 401 missing/invalid auth, 403 forbidden, 500 internal — no secret leakage.

## Frontend change `src/app/components/TeamPage.tsx`
Replace `handleAdd` body so it calls the edge function instead of a direct insert:

```ts
const { data, error } = await supabase.functions.invoke('invite-employee', {
  body: {
    tenant_id: tenantId,
    name: formData.name,
    email: formData.email,
    phone: formData.phone || null,
    permissions: formData.permissions,
  },
});
if (error || !data?.ok) { showToast(t('Failed to add member', 'فشل إضافة العضو')); return; }
setMembers([...members, { id: data.member_id, ...formData, status: 'active' }]);
setShowAdd(false);
showToast(
  data.email_sent
    ? t(`Invitation email sent to ${formData.email}`, `تم إرسال دعوة بالبريد إلى ${formData.email}`)
    : t(`Member added — email failed to send`, `تمت إضافة العضو — فشل إرسال البريد`),
);
```

Also wire `resendInvite()` to call the same function (re-invoking generates a fresh password and re-sends), so the existing "Resend invitation" menu item starts working.

No UI changes, no design changes, no other files touched.

## Not in scope
- Auth signup/reset emails (separate follow-up you mentioned earlier).
- Edit-member flow does not send email.
- Email logging table / dashboard.
- Switching to Lovable Emails / domain provisioning.

## Verification
1. Add a new member with a fresh email on `/dashboard/team` → row appears in `team_members`, Arabic RTL email lands in inbox: header, store name, email + password card, date/time, login button.
2. Add a member whose email already has an auth account → row inserted, email arrives with a freshly reset password.
3. Click "Resend invitation" → new email arrives with a new password.
4. Supabase edge-function logs show 200; Resend response is 200.

## Files
- New: `supabase/functions/invite-employee/index.ts`
- Edit: `src/app/components/TeamPage.tsx` (`handleAdd`, `resendInvite`)
