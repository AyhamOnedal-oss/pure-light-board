## Landing Page notifications

Add unread indicators for new leads and new notes across the admin Landing Page area, scoped per admin user (stored in `localStorage`, same pattern as `src/app/utils/notifications.ts`).

### 1. Sidebar badge (`AdminLayout.tsx`)
- Next to the "صفحة الهبوط" nav item, show a red dot + count of leads whose `created_at` is newer than the user's last-seen timestamp `fuqah.admin.landing.list.<userId>`.
- Subscribe to `admin_landing_leads` via Supabase Realtime so the badge updates live.

### 2. Landing Page list header (`LandingLeadsTable.tsx` / page wrapper)
- Next to the "صفحة الهبوط" title, render two pill badges:
  - **جديد (N)** — count of leads created after last list-seen.
  - **ملاحظات (N)** — count of leads whose notes array grew since last seen (tracked via `fuqah.admin.landing.notes.<userId>.<leadId>` storing last known notes length/timestamp).
- On mount, mark list as seen (update `landing.list.<userId>` ts) so sidebar badge clears once admin opens the page. Per-row indicators remain until that row is opened.

### 3. Per-row indicators (`LandingLeadsTable.tsx`)
- Red dot next to the customer name when the lead is "new" (created after the row's per-lead opened ts `fuqah.admin.landing.open.<userId>.<leadId>`).
- Small note icon + count next to the name when notes count is greater than the stored seen-notes count for that lead.
- Opening the lead detail page (`AdminLandingLeadDetailPage`) clears both markers for that lead (sets opened ts = now, seen notes count = current length).

### 4. Storage keys (extend `src/app/utils/notifications.ts`)
```
fuqah.admin.landing.list.<uid>          // last time admin viewed the list
fuqah.admin.landing.open.<uid>.<leadId> // last time admin opened that lead
fuqah.admin.landing.notes.<uid>.<leadId>// last seen notes count for that lead
```

### Technical notes
- Use existing `fetchLandingLeads()` + a Realtime channel on `admin_landing_leads` (INSERT/UPDATE) to drive both sidebar and header counts without polling.
- No DB migration required — purely presentation/state, matches the existing tickets/notes badge pattern.
- Scope: only files touched are `AdminLayout.tsx`, `LandingLeadsTable.tsx`, `AdminLandingLeadDetailPage.tsx`, and `src/app/utils/notifications.ts` (new key helpers).
