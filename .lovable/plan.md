## What's wrong today
- The admin invite email points to `www.fugah.ai` and `support@fugah.ai` (typo of `fuqah.ai`). The merchant invite has the same typo too, so both need correcting.
- The admin invite already uses `/admin/login?email=...&invite=1`, which is correct — but I'll also align the email layout/wording with the merchant invite so the experience is consistent (just rebranded for "Admin Panel").
- The invite still leaves an auto-created personal merchant workspace on the new account (covered by the previous plan), which is what makes admin employees look like merchant users.

## Recommended labeling pattern (industry standard)
Most SaaS apps separate "internal staff" from "tenant users" with three layers:

1. **Identity layer (auth.users)** — one shared user table. Don't fork it.
2. **Role layer (`auth_user_roles`)** — global roles like `super_admin`, `admin` (= internal Fuqah staff), `support`. We already have this.
3. **Membership layer (`auth_tenant_members` + `team_members`)** — only merchants and merchant employees get rows here. Internal staff get **zero** tenant memberships.

On top of that, add **two visual/UX signals** so the two populations never get confused:
- A separate, branded login page (`/admin/login`) — already exists.
- An `is_internal: true` flag (or simply: "has `admin`/`super_admin` role and no tenant membership") used by the UI to badge them as "Fuqah Staff" in lists, hide them from merchant analytics ("All clients" KPI already excludes `super_admin`; we'll also exclude `admin`), and route them straight to `/admin`.

This is exactly how Linear, Intercom, Stripe Dashboard, and Vercel handle staff vs customer accounts: one auth table, a global role enum, no tenant membership for staff, and a distinct admin entry point.

## Plan

1. **Fix the invite email content (`admin-invite-employee`)**
   - Replace every `fugah.ai` with `fuqah.ai` in the footer and support mailto.
   - Keep the login button pointing at `${APP_URL}/admin/login?email=...&invite=1`.
   - Mirror the merchant invite layout (header gradient, login box, footer) but keep the red "Admin Panel" badge + "فريق إدارة فقاعة AI" wording so the recipient knows it's the internal panel.
   - Same fix in the resend flow.

2. **Fix the merchant invite email typo (`invite-employee`)**
   - Same `fugah.ai` → `fuqah.ai` correction in the footer and support address.

3. **Stop creating a merchant workspace for internal admins (`admin-invite-employee`)**
   - After `createUser`, immediately remove the auto-provisioned personal workspace and tenant membership for that user (same cleanup `invite-employee` already does for invitees).
   - Hard-fail the request if granting `auth_user_roles.role = 'admin'` fails, instead of silently continuing.

4. **Backfill the existing affected account**
   - Delete the leftover "A's Workspace" tenant + membership for `ayhamwork34@gmail.com` so the account stops looking like a merchant user.

5. **Tighten KPI + routing separation**
   - Update `admin_kpis` so "All clients" excludes both `super_admin` **and** `admin` (today it only excludes super_admin), so internal staff don't inflate client counts.
   - Route status toggles in `AdminTeam` through `admin-invite-employee` so activate/deactivate grants/revokes the `admin` role atomically.

6. **Verify**
   - Send a fresh invite from `/admin/team`, confirm the email reads `fuqah.ai`, the button opens `/admin/login`, login lands on `/admin`, and the account has no tenant membership and no personal workspace.

## Technical notes
- Files touched: `supabase/functions/admin-invite-employee/index.ts`, `supabase/functions/invite-employee/index.ts`, `src/app/components/admin/AdminTeam.tsx`, one DB migration for `admin_kpis`, one data cleanup for the existing account.
- No schema changes — `auth_user_roles.admin` already exists from the previous round.