# Unified Activity Feed Table — User Dashboard

Add a clean, neat activity table at the bottom of `/dashboard` (DashboardPage) that aggregates conversations, tickets, and insight items into a single feed. Mock data only — no Supabase wiring yet. Bilingual (EN/AR) and dark/light aware to match the rest of the dashboard.

## Scope (this phase)

- Page: `/dashboard` only (DashboardPage.tsx)
- Next phases (not now): `/dashboard/team`, then other pages — same component reused once stable

## What the user sees

A new card titled **"Recent Activity"** under the existing dashboard charts:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Recent Activity                                          [Filter ▾] [⋯]   │
├────┬──────────┬──────────┬──────────────────┬──────────┬──────────┬───────┤
│ #  │ Type     │ Channel  │ Customer / Subj. │ Status   │ Updated  │  ⋯   │
├────┼──────────┼──────────┼──────────────────┼──────────┼──────────┼───────┤
│ 01 │ Convo    │ WhatsApp │ Sara · "Refund…" │ Open     │ 2m ago   │  ⋯   │
│ 02 │ Ticket   │ Web      │ #T-1043 Delivery │ Pending  │ 12m ago  │  ⋯   │
│ 03 │ Insight  │ —        │ Cash on delivery │ Trending │ 1h ago   │  ⋯   │
│ …                                                                          │
└────────────────────────────────────────────────────────────────────────────┘
                                                Showing 8 of 24 · [View all] │
```

### Columns
1. **#** — row index
2. **Type** — colored badge: Conversation / Ticket / Insight
3. **Channel** — WhatsApp, Instagram, TikTok, Web, Snapchat, etc., with the matching icon already in `src/imports/`
4. **Customer / Subject** — primary line (name or ticket #) + truncated secondary line (preview text)
5. **Status** — badge: Open, Pending, Resolved, Trending, New
6. **Updated** — relative time ("2m ago", "1h ago")
7. **Actions** — `⋯` dropdown per row

### Row actions (dropdown)
- **View** — opens a side sheet with full item details (read-only, mock)
- **Mark as resolved** — toggles row status to Resolved with a toast
- **Assign…** — submenu listing 4 mock agents; sets assignee with toast
- **Delete** — confirm dialog, removes the row from local state with undo toast

All actions operate on local React state since data is mocked.

## Visual polish (neat)

- Card style matches existing dashboard cards (same radius, border, shadow, padding)
- Sticky table header inside the card; max height ~520px with internal scroll so the page doesn't grow uncontrollably
- Zebra rows off; instead use a subtle row hover background
- Type and Status use small filled badges with their own color (Convo=blue, Ticket=amber, Insight=violet; Open=blue, Pending=amber, Resolved=green, Trending=violet, New=slate)
- Channel cell shows a 16px round icon + label
- Empty state: centered illustration + "No activity yet" copy
- Fully RTL-mirrored when Arabic is active (uses `useApp().t(en, ar)` and `dir`)
- Light + dark theme tokens from `src/styles/theme.css` only — no hard-coded colors

## Mock data

- ~24 rows generated inline at the top of the new component covering all three Types and all five channels, with realistic customer names, message previews, statuses, and timestamps spanning the last 24 hours
- Bilingual labels for Type, Status, and preview text via `t(en, ar)`

## Technical details

**New file:** `src/app/components/dashboard/RecentActivityTable.tsx`
- Default export `RecentActivityTable`
- Uses shadcn primitives already in repo: `Card`, `Table`, `Badge`, `DropdownMenu`, `Dialog`, `Sheet`, `Button`
- Channel icons resolved from `src/imports/` via a small `channelMeta` map (icon path + label)
- Local state: `rows: ActivityRow[]`, `selected: ActivityRow | null` (for the View sheet), `confirmDeleteId: string | null`
- Toasts via existing `ToastContainer` mechanism (or `sonner` if already wired — will check on implementation)
- Time formatting: tiny inline `formatRelative(date, lang)` — no new dependency

**Edit:** `src/app/components/DashboardPage.tsx`
- Import `RecentActivityTable`
- Render `<RecentActivityTable />` as the last block inside the existing dashboard layout, wrapped in the same outer container/grid the other sections use
- No changes to existing charts or insights

**No changes to:**
- Routing (`src/app/routes.tsx`)
- Supabase, schema, or types
- Other pages (Team, Conversations, Tickets, Admin, Settings)

## Out of scope (deferred)

- Search, column filters, sorting, pagination, CSV export — explicitly skipped per your selection (row actions only)
- Live Supabase data — mock only this phase
- Reusing the table on Team / other pages — next phase, after this one is verified stable

## Verification checklist after build

- `/dashboard` renders without errors in EN and AR
- Table is visible under existing content, looks consistent with surrounding cards
- All four row actions work on mock data and show toasts
- Dark and light themes both look clean
- No regressions on Team, Conversations, Tickets, or Admin pages
