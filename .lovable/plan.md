## Current state

The Admin → Team page (`AdminTeam.tsx`) is purely local. Add/Edit/Delete/Toggle only mutate React state; nothing is persisted to `admin_team_members` and no email is sent. That's why new admins never "activate" — there's no auth user, no row, no email.

The user-side Team page already has the correct flow via the `invite-employee` edge function: it generates a password, creates an auth user, inserts a `team_members` row, and emails a branded Arabic RTL welcome message with credentials + login link through Resend.

## Plan

Mirror that flow for the admin panel.

### 1. New edge function `admin-invite-employee`
Based on `invite-employee`, with these differences:
- Authorization: caller must have `super_admin` role (use `has_role`), not tenant membership.
- No tenant logic. Writes to `public.admin_team_members` instead of `team_members`.
- Fields persisted: `name`, `name_ar`, `email`, `phone`, `permissions` (text[]), `status`.
- Same Resend HTML template (Arabic RTL welcome) but with copy adjusted to "تمت إضافتك كعضو في فريق الأدمن لمنصة فقاعة AI" and the login URL pointing to `/admin`.
- On edit (when `member_id` is passed): just update the row + permissions, do NOT reset password or resend email.
- Returns `{ ok, member_id, email_sent }`.

### 2. New edge function `admin-delete-employee`
- Super-admin only. Deletes the `admin_team_members` row by id. (Auth user is left intact since they may be used elsewhere.)

### 3. Migration
- Add RLS policies on `admin_team_members` allowing super-admins to select/insert/update/delete (the form needs to read fresh data after invite).
- Ensure `GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_team_members TO authenticated` and `GRANT ALL ... TO service_role`.

### 4. `AdminTeam.tsx` rewrites
- `handleSave`:
  - If `editId` null → call `supabase.functions.invoke('admin-invite-employee', { body: { name, name_ar, email, phone, permissions, status } })`, then refetch list. Toast: "تمت الإضافة وتم إرسال رسالة الدخول للموظف".
  - If editing → call same function with `member_id` so it only updates the row (no new password, no email).
- `handleDelete` → call `admin-delete-employee`, then refetch.
- `toggleStatus` → update `admin_team_members.status` directly via supabase client, then refetch.
- "Re-send Password" button (Send icon) → call `admin-invite-employee` with `{ member_id, resend: true }`. The function then regenerates a password, updates the auth user, and re-sends the email. Toast: "تم إرسال كلمة المرور الجديدة عبر البريد".
- Remove the fallback to `MOCK_TEAM` once the table is reachable.

### 5. Deploy
Deploy `admin-invite-employee` and `admin-delete-employee` after creating them.

## Result
Adding an admin employee in `/admin/team` will create their auth account, save them to `admin_team_members`, and email them the same branded welcome with login credentials — identical UX to the user-side team invite.
