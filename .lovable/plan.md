## Landing Page — 4 polish fixes

### 1. Pipeline sidebar notification after "Copy to Customer Flow"
- In `AdminPipelinePage.tsx`, `addCustomer()` currently sets `viewed: true` for every newly created customer, including ones copied from the landing page — so the "سير العملاء" sidebar badge never increments.
- Change the `LandingLeadsTable` callback to mark copied leads as **unread** (`viewed: false`). Concretely, add a parameter to `addCustomer` (e.g. `markUnread`) and pass `true` for the landing-copy path. The existing `countNewLeads` already drives the sidebar badge, so it will tick up immediately and clear once the admin opens the pipeline list.

### 2. Replace source text with platform icons in the table
- The current `SourceCell` shows `<PlatformIcon platform=... />` (wrong prop name — component expects `id`) plus an Arabic/English text label.
- Rewrite `SourceCell` in `LandingLeadsTable.tsx`:
  - Use `<PlatformIcon id={mapped} size={20} />` (correct prop) for `tiktok`, `facebook`, `instagram`, `snapchat`, `google` — **icon only**, no text label.
  - Fall back to the small text label only for `ecommerce` / `other` / `manual` (no logo available), or to a neutral globe icon.
  - Add a `title` attribute so hovering the icon still shows the platform name for accessibility.
- (User will send updated logo PNGs — they drop into `src/imports/` and replace the existing files referenced by `platformIcons.tsx`; no code change needed for the swap.)

### 3. Hijri "هـ" duplicated in the customer card
- `AdminLandingLeadDetailPage.tsx` formats the Hijri date with `Intl.DateTimeFormat('ar-SA-u-ca-islamic', …)`, which already appends "هـ" to the year. The JSX then renders `{hijri} هـ`, producing the doubled marker.
- Fix: drop the trailing literal ` هـ` from the JSX and render `{hijri}` as-is. Both Gregorian and Hijri lines will show cleanly with a single, correctly-placed era marker.

### 4. Table column widths — email too wide, Actions clipped
- In `LandingLeadsTable.tsx` the table uses `minWidth: 1200` with no per-column sizing, so Email stretches and Actions overflow off-screen.
- Adjustments:
  - Reduce table `minWidth` to ~1080 and add `<colgroup>` with explicit widths: `#` 48, Name auto, Phone 140, **Email 220 (truncate with ellipsis + `title` tooltip)**, Customer Type 110 (placed immediately after Email), Contact Time 110, Source 90, Assign 120, Subject auto, Match 110, Actions 90.
  - Add `truncate max-w-[220px]` + `title={lead.email}` on the Email cell so long addresses don't push the layout.
  - Keep column order: #, Name, Phone, Email, Customer Type, Contact Time, Source, Assign Employee, Subject, Match, Actions — Customer Type sits right next to Email as requested.
- Result: Actions column is visible without horizontal scrolling on standard admin viewports.

### Files touched
- `src/app/components/admin/AdminPipelinePage.tsx` — `addCustomer` accepts an "unread" flag; landing copy path passes it.
- `src/app/components/admin/LandingLeadsTable.tsx` — `SourceCell` rewrite, table `<colgroup>` + email truncation.
- `src/app/components/admin/AdminLandingLeadDetailPage.tsx` — remove duplicate ` هـ`.

No DB/schema changes, no edge-function changes.
