## Plan

1. **Stop the repeated “فشل تحميل النشاط” toast spam**
   - Update the toast system to deduplicate identical messages that are already visible.
   - Make error toasts visually distinct, but prevent the same backend/loading failure from stacking dozens of times.

2. **Fix workspace synchronization for invited employees**
   - Update tenant resolution so invited employees do not default to their auto-created personal workspace.
   - Prefer the tenant where the user has a `team_members` row, then prefer non-owner memberships, and only use an owner workspace for normal admins/owners.
   - Add a safe one-time cleanup for the affected invited email: remove the personal workspace membership/workspace created by `handle_new_user`, and keep the user attached to **test 15**.

3. **Enforce locks correctly for tickets and other denied scopes**
   - Fix permission resolution so `team_members.permissions` is used even if the employee also has an accidental owner membership elsewhere.
   - Ensure the sidebar shows locked items immediately while permissions are loading instead of temporarily showing full access.
   - Keep `/dashboard/tickets` route blocked when `tickets` is not granted, redirecting to the first allowed page.

4. **Harden the invite flow going forward**
   - Update `invite-employee` cleanup so existing users with an auto-created personal workspace are cleaned up too, not only brand-new users.
   - Ensure the invitee is always linked by `user_id` and enrolled into the inviter’s tenant.

## Technical notes

- Existing database shows the invited user is correctly linked to **test 15**, but still also has an older personal workspace (`ايهم's Workspace`) as `owner`; tenant selection currently picks the oldest membership, causing the wrong workspace.
- The current permission hook returns `all` during missing tenant/loading states, which can briefly unlock tickets. I’ll change this to a safe loading/empty state for employees.
- I will use a data change for the affected personal workspace cleanup and code changes in `AppContext`, `permissions`, `Layout`, `ToastContainer`, and `invite-employee`.