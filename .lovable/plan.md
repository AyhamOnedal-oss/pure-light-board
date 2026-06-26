## Plan

1. **Fix the real permission source**
   - Add a secure self-read rule for `admin_team_members` so an admin staff member can read their own row by `user_id`.
   - This fixes the current bug where `ayhamwork34@gmail.com` has permissions in the super-admin table, but the staff login cannot read its own permissions, so the app treats them as having none.

2. **Make permission checks match the super-admin assignment UI**
   - Update the database helper so child permissions work correctly:
     - `billing_subscriptions` grants access to subscription invoices data.
     - `pipeline` grants access to the customer pipeline.
     - `reports_zid` / `reports_salla` / `reports_all` grant reports data needed for those pages.
     - `ad_automation_add/delete/sync` can open the automation section while still restricting buttons by their exact permission.
   - Update RLS policies for admin dashboard/reports/invoices/ad automation tables so staff sees the same permitted data as super admin on allowed pages, not zero/fallback data.

3. **Load staff permissions reliably in the frontend**
   - Change `AppContext` to load admin staff permissions from the now-readable staff row, with a safe fallback if needed.
   - Keep permission loading active until the row is resolved, preventing the sidebar from rendering everything as blocked for one account.

4. **Fix route redirects**
   - Ensure admin staff is sent to the first page they actually have permission for.
   - Keep `/admin` accessible for `ayhamwork34@gmail.com` because the database confirms `admin_dashboard` is granted.

5. **Show all sidebar fields and subfields**
   - Keep every admin menu item visible.
   - Show allowed items as clickable.
   - Show restricted parent and child items with the red “no access” sign instead of hiding subfields.

6. **Verify with the current staff row**
   - Confirm `ayhamwork34@gmail.com` reads these permissions: `admin_dashboard`, `pipeline`, `billing_subscriptions`.
   - Confirm the admin dashboard opens, pipeline opens, subscription invoices open, and restricted sections remain blocked with the no-access icon.