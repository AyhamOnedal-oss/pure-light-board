# Fix Dashboard Conversations Page Flashing

## Problem

`/dashboard/conversations` keeps alternating between the full conversation view and a blank "جاري التحميل…" screen every ~5 seconds.

## Root Cause

In `src/app/components/ConversationsPage.tsx`:

1. A `setInterval` polls every 5 seconds and calls `loadConversations()`.
2. Every call to `loadConversations()` runs `setLoading(true)` at the start, which causes the UI to swap to the "loading" placeholder — wiping the chat detail view — until the fetch finishes.
3. The Supabase Realtime channel already covers inserts/updates, so the aggressive 5s poll + visibility/focus refresh stack is overkill and was the source of the flicker.

## Fix

Edit `src/app/components/ConversationsPage.tsx`:

1. Track "first load" vs "background refresh":
   - Add a `hasLoadedRef` (useRef) inside the component.
   - `loadConversations()` only calls `setLoading(true)` when `!hasLoadedRef.current`. After the first successful load, set it to `true` so subsequent refetches update the data silently without unmounting the chat view.
2. Remove the 5-second `setInterval` poll entirely — Realtime + focus/visibility is enough and matches the pattern in `useDashboardMetrics`.
3. Keep the debounced realtime refetch and the focus/visibility refresh (silent — they won't flip `loading` anymore).

## Out of Scope

- No changes to widget, tickets, or dashboard metrics — the issue is isolated to the conversations page refresh loop.
