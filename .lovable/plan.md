## What I found

- The current preview session in the network snapshot is logged in as `1dvxjdpzs6@zam-partner.email`, role `owner`, not Ayham. Owners correctly see no locks.
- Ayham is correctly in the database as `viewer` on workspace `test 15` with only:
  - `home: true`
  - `team: true`
- The published site is still serving an older frontend bundle (`assets/index-CFuS5b3r.js`). Frontend code changes require publishing/update to go live; database/RLS changes are already live.
- The likely source of `فشل تحميل النشاط` is ticket activity loading (`tickets_activities`) after RLS was tightened. A user without `tickets` access must not be querying ticket activity at all.

## Plan

1. **Make sidebar locks impossible to miss**
   - Ensure non-owner/non-admin users with only `home` + `team` see locks on:
     - conversations
     - tickets
     - all restricted settings items
   - Locked items stay visible and show the Arabic no-access message when clicked.

2. **Stop restricted pages from loading data**
   - Update route/permission handling so users without `tickets` or `conversations` are redirected before those pages issue Supabase queries.
   - This prevents restricted RLS queries from producing noisy errors/toasts.

3. **Fix the activity toast source**
   - In the tickets activity loading flow, handle Supabase errors explicitly.
   - If the user lacks `tickets`, do not show `فشل تحميل النشاط`; show the lock/no-access behavior instead.
   - If activity fails for a permitted user, show only one controlled app toast.

4. **Verify database behavior**
   - Confirm `member_can()` allows Ayham only for `home` and `team`.
   - Confirm restricted table reads return no data/permission denial for Ayham and still work for owner/admin.

5. **Publish step**
   - After implementation, you must click **Publish → Update** for the published URL to receive frontend changes.
   - The DB permission changes do not need publishing; they are already live.