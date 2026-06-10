## Problem
`ConversationsPage` loads the list once on mount (and on tenant/language change). Status changes that happen later — whether driven by the customer closing the widget, the AI's `offer_close`, the inactivity timer in `ChatWindow`, or the `auto-close-stale-conversations` cron — are written to `conversations_main.status='closed'` in the database, but the dashboard never re-fetches, so the UI keeps showing the conversation as open until the user reloads.

## Fix (minimal, frontend only)
Add a live refresh to `src/app/components/ConversationsPage.tsx`:

1. **Supabase Realtime subscription** on `conversations_main` for the current `tenant_id`.
   - Listen to `UPDATE` events.
   - On any payload received, call `loadConversations()` (already exists).
   - Clean up the channel on unmount / tenant change.

2. **Focus / visibility refresh** as a safety net for tabs that lose the realtime socket (or when the customer's session closes via the server cron while the dashboard tab was in the background):
   - On `window` `focus` and `document` `visibilitychange` (when visible), call `loadConversations()`.
   - Debounce so rapid focus events don't spam the API.

That's it — no schema, no edge function, no widget changes. The close paths already write the correct row; the dashboard just needs to notice.

## Files touched
- `src/app/components/ConversationsPage.tsx` — add the realtime channel + focus listener inside the existing `useEffect`.

## Out of scope (explicitly not changing now)
- The per-tenant timer question for `auto-close-stale-conversations` (still uses hard-coded 15 min). You said "keep it simple" — this plan only fixes the dashboard not reflecting closes. Say the word and I'll do the per-tenant cron in a follow-up.
- Tickets page realtime — same pattern can be applied later if you see the same staleness there.
