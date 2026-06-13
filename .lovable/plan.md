## Goal
When an admin sets a team member's status to `inactive` ("معطل"), that member should be fully frozen: no access to any section's data or actions. Instead, on any `/dashboard/*` route they should see a single full-screen "تم تعطيل حسابك" card (matching the attached screenshot) with only a logout button. They cannot be re-enabled until an admin reactivates or deletes them.

## Current behavior
`useCurrentMemberPermissions` already detects `status === 'inactive'` and returns `disabled: true` with `perms = {}`. But nothing in the app reads `disabled`: `RequirePermission` only redirects via `firstAllowedPath`, which falls back to `/dashboard`, so a disabled member still lands on the (empty) home page. Tenant owners/admins bypass the check entirely (`perms = 'all'`) so they are never frozen — correct.

## Changes

### 1. New component `src/app/components/AccountDisabledScreen.tsx`
Full-screen centered card, RTL, matching the screenshot:
- Red circular icon (`LogOut` from lucide-react) on a `bg-destructive/10` circle
- Title: `تم تعطيل حسابك` / `Your account is disabled`
- Subtitle: `يرجى التواصل مع مسؤول المساحة الخاصة بك لاستعادة الوصول.` / English equivalent
- Primary button `تسجيل الخروج` that calls `supabase.auth.signOut()` then navigates to `/login`
- Uses existing design tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-destructive`) — no hardcoded colors
- Reads `language` from `useApp()` for AR/EN labels

### 2. `src/app/components/RequirePermission.tsx`
After the loading check, if `disabled === true`, return `<AccountDisabledScreen />` directly — skipping both the permission lookup and the wrapped children. This freezes every `/dashboard/*` route (home, conversations, tickets, team, settings/*) since they all go through `RequirePermission`.

### 3. `src/app/components/Layout.tsx` (sidebar/topbar)
Also short-circuit the sidebar/header chrome when the signed-in member is disabled, so the user does not see navigation links to pages they cannot open. Use the same `useCurrentMemberPermissions` hook (already used for filtering the menu) and, when `disabled`, render `<AccountDisabledScreen />` instead of the layout shell. I will read `Layout.tsx` first to confirm the exact integration point before editing.

### 4. No changes to data layer / Supabase
- `team_members.status = 'inactive'` is already the source of truth — admins toggle it from `TeamPage`.
- RLS already scopes data per `tenant_id` + role; the frozen UI is purely a client-side guard. (A future hardening pass could add an RLS predicate `team_members.status = 'active'` for invited members, but that is out of scope here unless requested.)

## Out of scope
- Backfilling existing rows or migrating statuses
- Sign-in blocking at the auth layer (disabled users can still log in; they just see the frozen screen)
- Email notification when an account is disabled
- Changes to how admins toggle status in `TeamPage` (already works)
