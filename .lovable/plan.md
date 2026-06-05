I understand the flow: the invited employee (ayhamonedal) should enter the same `test 15` workspace and see the same dashboard metrics, but only the sections granted in Team permissions should be usable; all other sidebar items should remain visible but locked/low-opacity.

Plan:

1. Fix the permissions loading default
- Change the current-user permissions hook so it never starts as `all` for a normal dashboard user.
- Only return `all` after confirming the user is a super admin, owner, or admin.
- While permissions are still loading, return an empty permission map so locked sections never briefly appear unlocked.

2. Make the sidebar wait for real permissions
- Update `Layout.tsx` to use the permission hook’s `loading` value.
- During permission loading, render restricted navigation as locked instead of treating the user as admin.
- Keep locked items visible with low opacity and a lock-style indicator, including Tickets.

3. Keep dashboard data shared, but restrict page access
- Leave dashboard metric queries scoped by `tenant_id`, so the employee still sees the same `test 15` dashboard info.
- Keep route protection for restricted pages, so direct navigation to `/dashboard/tickets` redirects to the first allowed page.
- Do not tighten RLS for dashboard/tickets data reads, because that would break the “same dashboard info” requirement.

4. Stop the repeated failure spam
- Harden the toast system with a short cooldown per message, not just deduping currently visible toasts.
- This prevents repeated Arabic `فشل...` messages from stacking when a restricted page/component retries or fails repeatedly.

5. Clean up the current ayhamonedal workspace rows
- Remove the stale personal workspace `ayhamonedal's Workspace` and any leftover owner membership for that user if still present.
- Keep only the `test 15` membership as `viewer` plus the `team_members` row with the two selected permissions (`home`, `team`).

6. Verify the exact test user state
- Confirm `ayhamonedal@icloud.com` resolves to `test 15`.
- Confirm their effective permissions are only `home` and `team`.
- Confirm Tickets appears locked in the sidebar and cannot be opened directly.