## Issues & root causes

**1) Email "تسجيل الدخول" goes to Lovable preview, not the published app**
`invite-employee` builds `loginUrl` from `req.headers.get("origin")`. When the admin clicks Save inside the Lovable editor preview (iframe), `origin` is the lovableproject.com preview URL, so the email button points there. We'll switch to an explicit allow-listed public URL, env-overridable, defaulting to `https://pure-light-board.lovable.app/login`.

**2) Invited user gets a brand-new workspace with full access (not the inviter's workspace, no permission lock)**
Two compounding bugs:
- `handle_new_user` trigger fires for every `auth.users` insert — including the one the edge function creates for the invitee — so it provisions a new `settings_workspace` + makes the invitee its `owner`. AppContext then picks the *oldest* membership = that fresh workspace.
- The edge function only writes a `team_members` row, never an `auth_tenant_members` row, so the invitee is not actually a member of the inviter's tenant in auth terms; and nothing in the app currently consults `team_members.permissions` to lock the sidebar/routes for the signed-in user.

**3) Same phone can be invited twice** — no uniqueness check on `phone` (only on email).

---

## Plan

### A. Edge function `supabase/functions/invite-employee/index.ts`
1. Replace the dynamic origin with a stable login URL:
   - `const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://pure-light-board.lovable.app";`
   - `loginUrl = ${APP_URL}/login?email=…`
2. Add duplicate-phone guard (per tenant) before insert:
   - if `phone` provided, query `team_members` where `tenant_id` + normalized `phone` matches and `!allow_existing` → `409 phone_exists`.
3. After creating/finding the auth user, **enroll the invitee into the inviter's tenant**:
   - `upsert` into `auth_tenant_members` `(tenant_id, user_id, role='viewer')` on conflict do nothing.
   - Persist `user_id` on the `team_members` row (new column, see migration) so the dashboard can resolve the invitee's permissions on sign-in.
4. If the auth user was just created by us (`isNewUser`) and the `handle_new_user` trigger auto-provisioned a personal workspace, clean it up so the invitee only sees the inviter's tenant:
   - find tenants where the invitee is the **sole owner** and there are no other members → delete `settings_workspace` row (cascades). Skip if any other members exist (safety).
5. Front-end client error mapping: handle `409 phone_exists` with Arabic toast.

### B. Migration (new file)
- `ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id uuid;`
- `CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);`
- Optional: `CREATE UNIQUE INDEX team_members_tenant_phone_uniq ON public.team_members(tenant_id, phone) WHERE phone IS NOT NULL;` (defense-in-depth alongside the edge-function check).

(No change to `handle_new_user` — leaving the trigger intact for normal sign-ups; cleanup happens in the edge function for invites only.)

### C. Frontend permission gating
1. New hook `useCurrentMemberPermissions()` in `src/app/utils/permissions.ts`:
   - if `isSuperAdmin` → `'all'`.
   - else load `team_members` row where `tenant_id = tenantId AND user_id = auth.uid()` → return its `permissions` object; if no row exists (the tenant owner) → `'all'`.
2. `Layout.tsx`: replace the current `localStorage`-based `userPerms` resolution with the hook so the sidebar hides items the invitee can't access (already uses `can(key)`).
3. New `RequirePermission` wrapper used in `routes.tsx` for `/dashboard/*` children (team, conversations, tickets, settings/*). If not allowed → redirect to `/dashboard` (home) or to the first allowed page; if home itself is disabled, redirect to the first allowed page.

### D. UX copy
- `TeamPage` MemberModal: show Arabic error `لا يمكن إرسال دعوة لنفس رقم الهاتف مرتين` when server returns `phone_exists`, mirroring the existing `email_exists` handling.

---

## Files touched
- `supabase/functions/invite-employee/index.ts` (login URL, phone dup, tenant enrollment, auto-tenant cleanup)
- `supabase/migrations/<new>.sql` (`team_members.user_id` + optional phone unique index)
- `src/app/utils/permissions.ts` (hook + helpers)
- `src/app/components/Layout.tsx` (use hook)
- `src/app/routes.tsx` (RequirePermission gate)
- `src/app/components/TeamPage.tsx` (phone_exists toast)

## Out of scope
- Reworking `handle_new_user` (kept for normal signups).
- Changing roles model — invitee stays `viewer` in `auth_tenant_members`; granular access is driven by `team_members.permissions`.
