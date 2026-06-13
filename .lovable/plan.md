# Show real member name on ticket notes / status changes

## Problem
When a team member adds a note or closes/reopens a ticket, the activity feed shows the author as **"Ahmed Al-Rashid"** / role badge **"مسؤول"** (Admin) instead of the actual member's name.

Root causes in `src/app/components/TicketsPage.tsx`:
1. `authorName` is derived from `user.user_metadata.display_name` → `email.split('@')[0]` → falls back to the hard-coded demo constant `CURRENT_USER_NAME = 'Ahmed Al-Rashid'`. Invited team members rarely have `display_name` set in auth metadata, so we land on the email prefix or the fallback.
2. `authorRole` is set to `'admin'` only when `isSuperAdmin`; every other tenant member is sent as `'team'`. The displayed badge "مسؤول" comes from a *different* code path: the NotesActivityPanel `roleBadge('admin', …)` renders "مسؤول" for any row whose `author_role === 'admin'`. Legacy/seed rows and the per-tenant owner can also be 'admin'.
3. The composer footer shows `CURRENT_USER.role` (always 'admin' from the demo constant), so it always reads "(مسؤول)" regardless of who is logged in.

## Fix
Resolve the **real** name + role for the signed-in user from tenant data, then use it everywhere the author is recorded or displayed.

### 1. `src/app/components/TicketsPage.tsx`
- Replace the `authorName`/`authorRole` derivation with a small `useEffect` that, on `(tenantId, user.id)` change, fetches in parallel:
  - `team_members.name, permissions` where `tenant_id = ? AND user_id = ?`
  - `settings_account.display_name` where `user_id = ?`
  - `auth_tenant_members.role` where `tenant_id = ? AND user_id = ?`
- Compose:
  - `authorName = team_members.name || settings_account.display_name || user.user_metadata.display_name || email-prefix || 'Member'`
  - `authorRole = isSuperAdmin ? 'admin' : (auth_tenant_members.role in ('owner','admin') ? 'admin' : 'team')`
- Pass the resolved `authorName` / `authorRole` to:
  - `tickets_activities.insert` in both `addNote` and `toggleStatus`
  - `<NotesActivityPanel currentUser={authorName} currentUserRole={authorRole} />` (replaces the `CURRENT_USER.*` props)

### 2. Display existing rows correctly
- Already correct: `loadTickets` reads `author_name` / `author_role` from the row and forwards them. Past rows that were saved as "Ahmed Al-Rashid" stay as historical record (we don't rewrite history). Only new notes/status changes from now on will show the real name.

## Out of scope
- Backfilling old activity rows.
- A dedicated avatar per member.
- Changing the role-badge color palette.

## Technical notes
- `settings_account` has `display_name` and is auto-populated on signup via `handle_new_user()`, so every user has a row.
- `team_members.name` is the canonical display name for invited tenant members and takes priority.
- Keep `author_user_id` writing unchanged so edit/delete ownership still works.
