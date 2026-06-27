## Scope
All changes are limited to the Admin → Landing Page screen (`/admin/pipeline/landing`) and the landing lead detail page. The Customer Pipeline page is left untouched.

## 1. Header badges (top of Landing Page)
File: `src/app/components/admin/AdminPipelinePage.tsx`

- On the landing tab, do **not** render the pipeline `headerCounts` chips. The "TRIAL ENDED / انتهى التجريبي" red chip is a subscription signal and must never show here.
- Compute landing-specific counts and pass them down from the table, or compute alongside via a tiny landing-counts hook:
  - `NEW / جديد` — count of landing leads created since this admin's last-seen timestamp (stored per-user in `localStorage` under `landing_seen_${userId}`).
  - `NOTES / ملاحظات` — count of leads whose newest note `createdAt` is newer than the same per-user `landing_seen` timestamp.
- Keep "Assignment Rules / قواعد التكليف" visible on the landing tab — it now applies to landing leads too (see §3).

## 2. Landing leads table (`LandingLeadsTable.tsx`)
- Remove the "Refresh / تحديث" button from the toolbar (keep the search input full-width). Reloads still happen on mount and after actions.
- Column order becomes: `#`, Name, Phone, Email, Customer Type, Contact Time, Source, **Assign Employee** (new), Subject, Match, Actions.
- New "Assign Employee" cell:
  - Reuses the same assignment popover styling as the Pipeline page (avatar + name, click to change). Admins can reassign; non-admins see the current assignee read-only.
  - Reads members from `loadMembers()` in `pipelineData.ts`.
- Lead-type color rule and red phone/email for non-`full` matches stay as-is.
- Actions menu items already cover Copy to Pipeline / Edit / Delete; verify wiring still works after the column reorder (no logic change, only DOM order).

## 3. Auto-assignment for landing leads
Goal: respect the existing Assignment Rules (round-robin / self-claim / manual) for new landing leads, just like pipeline customers.

DB migration (`admin_landing_leads`):
- Add column `assigned_member_ids text[] not null default '{}'`.
- No new policies needed; existing admin policies cover it.

Edge function `supabase/functions/landing-lead-submit/index.ts`:
- After inserting the lead, when assignment mode is `round_robin`, pick the next member from a small server-side cursor table (or fall back to writing `assigned_member_ids = []` and letting the UI assign — preferred minimal approach to avoid new infra).
- Minimal-change path: leave the function as-is; do the round-robin assignment in the client when the leads list loads and finds new unassigned rows (mirrors how the pipeline currently behaves when `simulate*` adds rows). Update `updateLandingLead` to persist `assigned_member_ids`.

Service (`src/app/services/adminLandingLeads.ts`):
- Add `assigned_member_ids: string[]` to `LandingLead`.
- Add `assignLandingLead(id, memberIds)` helper that updates the column.

## 4. Detail page (`AdminLandingLeadDetailPage.tsx`)
- Confirm the summary grid renders, in this order: Name, Customer Type, Phone, Email, Contact Time, Submitted (date), Source (only when `customer_type === 'new'`), Title (`subject`), Description (`description`). Title + Description already render unconditionally as full-width blocks — keep that.
- Submitted date row: render Gregorian on the first line and Hijri on a muted second line.
  - Use `Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year:'numeric', month:'long', day:'numeric' })` for Hijri and the existing `fmtDate` for Gregorian. Same dual format for note timestamps.
- Back button (`ArrowLeft` and breadcrumb root) navigates to `/admin/pipeline/landing` instead of `/admin/pipeline`. Same change for the "Lead not found" fallback button.

## 5. Touch list
- `supabase/migrations/<new>.sql` — add `assigned_member_ids` column.
- `supabase/functions/landing-lead-submit/index.ts` — include the new field in the insert (default `[]`).
- `src/app/services/adminLandingLeads.ts` — type + `assignLandingLead`.
- `src/app/components/admin/LandingLeadsTable.tsx` — remove Refresh, add Assign Employee column, render assignment popover, auto-run round-robin for unassigned leads on load.
- `src/app/components/admin/AdminPipelinePage.tsx` — hide pipeline `headerCounts` chips on landing tab, compute landing-only NEW/NOTES counts.
- `src/app/components/admin/AdminLandingLeadDetailPage.tsx` — Hijri+Gregorian dates, back-button target `/admin/pipeline/landing`.

## Out of scope
- Pipeline page table, stats, or modals.
- Match logic (still email + phone only, unchanged).
- Notification system beyond the two badges listed.
