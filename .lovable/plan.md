## Goal

Make صفحة الهبوط a proper sub-tab under سير العملاء, match the same Monday-style table look, allow opening each lead to add notes, and apply the requested column/data fixes.

## Changes

### 1. Tabs in `AdminPipelinePage.tsx`
Add a tab strip directly under the page title with two pills:
- `سير العملاء` (default)
- `صفحة الهبوط` (with a small counter pill for total leads)

Each pill mirrors the existing stat-card/filter styling (`#043CC8` active background). Only one table is rendered at a time; toolbar/stat-cards/Add Customer button only show on the pipeline tab. The landing tab renders the redesigned `LandingLeadsTable`.

### 2. Rebuild `LandingLeadsTable.tsx` to match the upper table 1:1
Replace the dark-teal header strip with the same component shell used by the pipeline table:
- White card with `rounded-2xl`, `border-border`, and a 3px `#043CC8` bottom border on the header strip.
- Header text: `صفحة الهبوط` in `#043CC8`, with a muted `count` chip.
- Same `<thead>` muted background, same `<Th>` typography, same row hover and divider style as `AdminPipelinePage`.
- Same kebab action menu styling.

Column tweaks per request:
- `نوع العميل`: render as plain text (no green/blue pill background, no chip border). Just `عميل جديد` / `عميل حالي` in regular foreground color.
- Remove the `منقول` badge entirely from the name cell (no copied indicator shown).
- `الموضوع`: render full text, allow wrapping (`whitespace-pre-wrap`, `max-w-[320px]`), no truncation.
- Name/phone/email: only color red when the field itself is the mismatch source. Specifically:
  - `none` → color phone + email red, name stays default.
  - `partial` → color only the missing side (email red if no email match, phone red if no phone match — derived from a new lightweight per-row flag from the trigger; until then both partial fields use amber as today).
  - `full` → default color.
- Name no longer renders a `PlatformIcon` prefix.

Legend (bottom strip): change the guide text to `البيانات الأساسية: رقم الجوال • الإيميل` (drop name + customer type) to reflect that match logic is email + phone only.

### 3. Row click → Landing Lead Detail page with notes
- Add new route `pipeline/landing/:id` in `src/app/routes.tsx`, guarded by the same `admin_pipeline` permission, rendering a new `AdminLandingLeadDetailPage.tsx`.
- The whole `<tr>` becomes clickable (cursor pointer, hover bg). The kebab `…` cell stops propagation.
- Detail page layout: breadcrumb (`إدارة العملاء › صفحة الهبوط › {name}`), summary card with all lead fields + the `match` pill, and a `Team Notes` panel ported from `AdminPipelineDetailPage` (same `StickyNote` header, textarea, "Add Note" button, reverse-chronological list, delete-on-hover). No attachments, no journey — notes only, to keep scope tight.
- Actions in the detail header: `نسخ إلى سير العميل`, `تعديل` (opens existing edit modal), `حذف`.

### 4. Persist notes for landing leads
Add a `notes jsonb NOT NULL DEFAULT '[]'::jsonb` column to `public.admin_landing_leads` via migration. Each note: `{ id, author, authorId, text, createdAt }`. Read/write through `adminLandingLeads.ts` with two helpers: `addLandingLeadNote(id, note)` and `deleteLandingLeadNote(id, noteId)` that update the JSON array atomically using a SQL `coalesce(notes,'[]'::jsonb) || …` update.

### 5. Service + types
- `LandingLead` interface gains `notes: LandingNote[]`.
- `markCopiedToPipeline` continues to record the link but the UI no longer displays the badge.

## Technical Notes

- Match function (`admin_landing_compute_match`) already matches on email + phone only — no SQL change needed there. The plan only changes UI legend wording and per-row red-coloring rules.
- Tabs use local component state (no URL param); deep links continue to land on the pipeline tab by default. Landing detail uses its own URL so it's still shareable.
- Keep the existing `LandingLeadsTable` props contract; `onCopyToPipeline` stays the same so we don't touch `AdminPipelinePage`'s `addCustomer`.
- No changes to widget, chat, or other unrelated areas.