## Goal
The marketing form sends two distinct fields, `subject` (الموضوع / Title) and `description` (الوصف), for both new and existing leads. Make sure both are captured end-to-end and both render on the lead detail page regardless of customer type.

## Current state
- DB has `subject` and `description` columns (verified — recent leads contain both values).
- Edge function `landing-lead-submit` already reads `description`, but it only stores `subject` when `customer_type === 'existing'` (drops it for "new").
- Detail page renders `description` (always) and `subject` (only when existing).

## Changes

1) `supabase/functions/landing-lead-submit/index.ts`
   - Always capture `subject` (trimmed, max 500 chars) regardless of `customer_type`. No more conditional drop.

2) `src/app/components/admin/AdminLandingLeadDetailPage.tsx`
   - Always render the "الموضوع / Title" block when `subject` is present (remove the `customer_type === 'existing'` gate).
   - Keep the "الوصف / Description" block as-is (always shown).
   - Order: Title (الموضوع) first, then Description (الوصف), both as full-width blocks under the summary grid.

3) `src/app/services/adminLandingLeads.ts`
   - No type change needed (subject + description already in `LandingLead`).

## Notes
- No migration required; columns already exist.
- Existing leads where `description` is null (e.g. old test rows) will continue to show "—" — that's expected, not a bug.