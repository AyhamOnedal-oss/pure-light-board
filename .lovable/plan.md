## Goal
When a member is disabled, they should still see the main dashboard, but the numbers must be exactly the dashboard data from the moment before they were disabled. No live refetches, no realtime updates, and no changed date range.

## Plan
1. **Add a persistent frozen snapshot**
   - Add columns to `team_members` for:
     - `disabled_at`
     - `dashboard_snapshot`
   - Store the dashboard metrics, top subjects, recent AI feedback, and selected range in that snapshot.

2. **Capture the snapshot before disabling**
   - In the Team page `Disable` action, fetch the current dashboard data first.
   - Save it into `team_members.dashboard_snapshot` in the same update that changes `status` to `inactive`.
   - When re-enabling, clear `disabled_at` and the stored snapshot.

3. **Load frozen data for inactive members**
   - Update permission resolution to also return the stored dashboard snapshot for inactive members.
   - Update the dashboard metrics hook so inactive members use `dashboard_snapshot` only.
   - In frozen mode, do not call live metric APIs and do not subscribe to realtime channels.

4. **Keep dashboard visible but locked**
   - Keep inactive members redirected to `/dashboard` only.
   - Keep the date picker disabled.
   - Show the frozen dashboard values without changing while the tenant’s live data continues updating for active users.

## Technical details
- Reuse the existing `fetchDashboardMetrics`, `fetchTopSubjectsByCategory`, and `fetchRecentAiFeedback` services to generate the snapshot before status changes to inactive.
- Add Supabase migration grants for any public schema changes as required.
- Update generated Supabase TypeScript types if needed for the new `team_members` columns.