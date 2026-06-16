## Why deleting a member takes ~6 seconds

I traced the flow end-to-end: `TeamPage.confirmDelete` → `supabase.functions.invoke('delete-employee')` → the edge function in `supabase/functions/delete-employee/index.ts`.

The UI today **awaits the full network round-trip** before removing the row and closing the confirmation modal. That round-trip is the sum of every step inside the function, done sequentially:

1. **Edge function cold boot** — first invocation after idle adds ~200–800 ms (visible in the Boot logs for sibling functions).
2. **`userClient.auth.getUser()`** — a network call to Supabase Auth to validate the JWT (~150–400 ms).
3. **Authorization lookup** (parallel pair of selects) — ~100 ms.
4. **`team_members` lookup by id** — ~80 ms.
5. **`team_members` soft-delete UPDATE** — ~80 ms. This also fires any row-level triggers/policies on that table.
6. **`auth_tenant_members` DELETE** — ~80 ms.
7. **Two COUNT queries** (parallel) to decide whether to nuke the auth user — ~100 ms.
8. **`admin.auth.admin.deleteUser(targetUserId)`** — this is the single biggest contributor. The Auth admin API typically takes **1.5–4 seconds** because it cascades through `auth.users` (identities, sessions, refresh tokens, MFA factors, audit log) and any `ON DELETE CASCADE` foreign keys pointing at `auth.users` from your schema.

Add it up: boot + ~5 sequential DB round-trips + the slow `deleteUser` call ≈ **4–6 seconds**, exactly what you're seeing. None of step 1–7 alone is the problem; it's that the **UI waits for step 8** before reacting.

The "disable member" action feels instant because it's a single UPDATE with optimistic UI (`setMembers` is called before any awaits).

## Plan to fix

Two changes, no schema/migrations:

### 1. `supabase/functions/delete-employee/index.ts` — return as soon as access is revoked

Critical path (what the user actually cares about) = the member can no longer log in and disappears from the list. That only needs steps 1–6. The auth-account cleanup (step 8) is housekeeping.

- After the soft-delete + `auth_tenant_members` delete succeed, **return `{ ok: true }` immediately**.
- Move the "count remaining memberships → `admin.auth.admin.deleteUser`" block into `EdgeRuntime.waitUntil(...)` so it runs in the background after the response is sent. Wrap it in try/catch and log failures; nothing in the UI depends on `auth_deleted` today.
- Drop `auth_deleted` from the response (or always return `false`); it's unused on the client.

Expected response time after this change: ~400–800 ms (boot + 4 quick DB calls), down from 4–6 s.

### 2. `src/app/components/TeamPage.tsx` — optimistic delete

Mirror the pattern already used by `toggleMemberStatus`:

- In `confirmDelete`, snapshot the member, call `setMembers(m => m.filter(...))` and `setDeleteConfirm(null)` and show the success toast **before** awaiting `supabase.functions.invoke`.
- If the invoke returns an error, restore the member into the list and show a failure toast.

With both changes the modal closes and the row disappears instantly; the network call resolves in the background and only surfaces if something actually failed.

### Out of scope

- No database migration.
- No change to which rows are deleted or to permissions.
- `delete-employee` keeps doing the same work; only the response timing and ordering change.
