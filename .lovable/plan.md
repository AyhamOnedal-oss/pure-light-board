## Plan

1. **Fix the invitation login link**
   - Change employee invitation emails so the **تسجيل الدخول** link always opens the correct app login page with the invited employee email prefilled.
   - Ensure the app uses the current preview/published app origin where appropriate instead of falling back to the Lovable/editor or old default domain.
   - Clear any stale signed-in session before showing an invite login screen, so clicking an invite cannot keep/register the user as the old `zam-partner.email` account.

2. **Harden invited employee workspace selection**
   - Keep invited users locked to the inviter workspace (`test 15`) by prioritizing the `team_members.user_id + tenant_id` link.
   - Prevent old owner/personal/Zid workspace sessions from winning tenant selection after sign-in.
   - Add a safe session/tenant refresh path after login so permission checks wait until the correct workspace is resolved.

3. **Fix permission locks for restricted sections**
   - Treat invited employees as restricted whenever they have a `team_members` row, even if they also have another tenant membership.
   - Keep Tickets locked when `tickets` is false and redirect blocked direct URLs away from `/dashboard/tickets`.
   - Make the sidebar lock state wait for permission loading instead of briefly showing full access.

4. **Stop the repeated “فشل تحميل النشاط” error spam**
   - Replace the toast behavior with true deduplication/throttling so the same error cannot stack repeatedly.
   - Guard dashboard/activity loading so it runs only after auth + tenant + permissions are ready.
   - Where activity data is optional or missing, show empty state silently instead of repeatedly raising failure toasts.

5. **Database cleanup and verification**
   - Verify the invited email is linked only to `test 15` as a restricted viewer and that `tickets` permission is false.
   - If needed, clean up stale rows tied to the wrong `zam-partner.email`/personal workspace for this employee without deleting the admin owner account.
   - Confirm duplicate phone invite protection remains active.

## Technical notes

- Main files to update: `AppContext.tsx`, `LoginPage.tsx`, `permissions.ts`, `Layout.tsx`, `RequirePermission.tsx`, and `supabase/functions/invite-employee/index.ts`.
- I’ll also inspect/adjust the dashboard activity source if it is still querying a missing/optional activity table.
- Edge function changes will need redeploy after editing.