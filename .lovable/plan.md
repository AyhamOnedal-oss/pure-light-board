## Goal

Move from UI-only permission gating to **database-enforced** permissions for invited employees while keeping the Home dashboard fully visible. Lock restricted sidebar items with an inline lock + no-access toast. Identify and silence the recurring `فشل تحميل النشاط` toast.

## Findings from investigation

- Ayham (`ayhamonedal@icloud.com`) is correctly stored as `auth_tenant_members.role = 'viewer'` in tenant `test 15`, and `team_members.permissions = { home: true, team: true }`. So role + permissions are persisted properly.
- The current RLS uses `is_tenant_member()` for SELECT on every tenant table. A viewer can therefore read **all** dashboard data (conversations, tickets, messages, usage). That's why the dashboard renders fully — which the user actually wants for Home. But the same access means the UI is the only thing blocking the Tickets / Conversations / Settings pages, so any flash or bug there leaks data.
- The sidebar locking code already exists in `Layout.tsx`, but it only locks when `permsLoading=false` AND user is not `'all'`. For ayham the tenant role is `viewer` (not owner/admin), so `useCurrentMemberPermissions` should return `{home:true, team:true}`. If user is still seeing every item active, the most likely cause is one of:
  - The session is resolved to the wrong tenant (his personal workspace where he is `owner`). The provider already prefers `team_members` tenant — confirm by logging which tenant id Layout received.
  - The `auth_tenant_members` row for ayham in `test 15` was added but the user signed in before it landed, leaving role temporarily missing — and the hook returned `{}` (locked). We need to also re-check the actual rendered output.
- `فشل تحميل النشاط` string does **not exist anywhere in src/ or widget/**. It is most likely emitted by the embedded storefront test-chat widget (`test 15` bubble in the screenshot) calling an endpoint it isn't authorized for and showing its own toast, or by a browser extension. We need to confirm the source before "fixing" it.

## Plan

### 1. DB-enforced permissions (viewer role + permission map)

Add a security-definer helper `public.member_can(_tenant, _user, _key text)` that returns:
- `true` if the user is `owner`/`admin`/`super_admin` for the tenant, otherwise
- `true` only if `team_members.permissions ->> _key = 'true'` for that user/tenant.

Replace the SELECT policies on the **restricted** tables so a viewer only sees rows when their permission allows it:

| Table | New SELECT rule |
| --- | --- |
| `conversations_main`, `conversations_messages`, `conversations_customers`, `conversations_channels` | `member_can(tenant_id, auth.uid(), 'conversations')` OR member is owner/admin |
| `tickets_main`, `tickets_activities` | `member_can(... 'tickets')` OR owner/admin |
| `settings_train_ai`, `settings_chat_design`, `settings_plans` | corresponding `settings_*` key OR owner/admin |
| `team_members` | unchanged — `is_tenant_member` (viewer can see team list since user picked "Manage team") |
| `dashboard_usage_daily`, `ai_classifier_usage`, `settings_workspace` | unchanged — Home dashboard must keep working |

All write policies stay as `tenant_role_at_least('agent')`/`'admin'`, which already blocks a viewer.

This way, even if the UI fails, a viewer literally cannot read tickets/conversations rows.

### 2. UI lock — already in place, harden it

Keep current `Layout.tsx` lock rendering. Add:
- A click handler on locked items that calls `showToast(t('You do not have access', 'ليس لديك صلاحية للوصول'))` (per user choice "Visible + message").
- A short debug-only log of `tenantId` + resolved role so we can verify in console that ayham really lands on `test 15`.

### 3. Team page

User chose "Manage team" — keep current Team page behavior unchanged for viewers with `team:true`. Owner/admin writes are already enforced by RLS.

### 4. Trace `فشل تحميل النشاط`

Before any code change related to this toast, capture its source:
- Open DevTools as ayham, inspect the toast DOM node, and check (a) its class/data attributes and (b) the failing network request immediately preceding each toast.
- Likely culprits: the storefront test-chat widget loaded on the merchant dashboard, an n8n activity endpoint, or a leftover polling call in admin code rendered for the wrong role.

Once identified, fix at the source (silence the failing fetch, or wrap it in a single deduped toast). The toast cooldown added previously already prevents stacking inside our app, so if stacking still happens the toast is being rendered outside our `ToastContainer`.

### 5. Database cleanup (still pending approval)

Delete the personal workspace auto-created for ayham at signup so the tenant resolver can't ever pick it instead of `test 15`:
- Remove his `auth_tenant_members` row where `role='owner'` in his personal workspace.
- Delete that personal `settings_workspace` row and its dependent `settings_*`.

## Technical notes (for review)

- New SQL function:
  ```sql
  create or replace function public.member_can(_tenant uuid, _user uuid, _key text)
  returns boolean language sql stable security definer set search_path = public as $$
    select
      public.tenant_role_at_least(_tenant, _user, 'admin'::tenant_role)
      or public.has_role(_user, 'super_admin'::app_role)
      or exists (
        select 1 from public.team_members
        where tenant_id = _tenant and user_id = _user
          and (permissions ->> _key)::boolean is true
      );
  $$;
  ```
- Policy rewrite pattern per restricted table:
  ```sql
  drop policy if exists tickets_view on public.tickets_main;
  create policy tickets_view on public.tickets_main for select to authenticated
    using (public.member_can(tenant_id, auth.uid(), 'tickets'));
  ```
- No schema changes to `team_members`/`auth_tenant_members` needed.

## What I will NOT change

- Home dashboard data sources (`dashboard_usage_daily`, conversations/tickets counts via RLS-allowed aggregates) — user wants full metrics regardless of section permissions, so counts queried from already-locked tables will need a small SECURITY DEFINER aggregation function so the Home page keeps working for viewers. I'll add `public.dashboard_counts(_tenant uuid, _from, _to)` and switch `services/metrics.ts` to call it instead of querying `conversations_main`/`tickets_main` directly.

## Open question I still need

After implementing, if `فشل تحميل النشاط` keeps appearing, please open DevTools → right-click that toast → "Inspect", and share the element's HTML and the failing network request next to it. Until then I can only stop it if it is from our `ToastContainer` (which the cooldown already handles).
