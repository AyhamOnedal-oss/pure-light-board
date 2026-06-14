## Scope

Three changes: widget rating screen char limit + counter, verify dashboard feedback bar persists, and investigate the ~13s widget render delay.

### 1. Widget rating screen — `widget/src/app/components/RatingScreen.tsx`

- Add `maxLength={115}` to the feedback `<textarea>` and clamp state.
- Add a transparent character counter at the bottom-left of the textarea:
  - `{feedback.length}/115`, `font-size: 11px`, `opacity: 0.5`, `pointer-events: none`, absolutely positioned inside a relative wrapper (`bottom: 6px; left: 10px`).
  - Color shifts to soft red (`#ef4444`) when `length >= 110`.
- No other layout changes.

### 2. Dashboard feedback bar — `src/app/components/ConversationsPage.tsx`

The yellow bar (⭐ + comment, lines 520-527) already exists and renders when `selected.ratingComment` is set. It isn't appearing for real conversations because the widget likely doesn't persist the comment.

- Trace the `onRatingSubmit(stars, feedback)` wiring from `RatingScreen` through `ChatWindow` / `chatApi` and confirm the rating endpoint writes `rating_comment` to the `conversations` row.
- If missing, include `comment` in the rate payload so the existing dashboard bar renders.

No styling change to the dashboard bar.

### 3. Widget render delay (~13s)

Goal: bubble must appear immediately on the storefront, not after ~13s.

Investigation steps:
- Profile `widget-loader` edge function and `widget-config` / `widget-resolve` calls — check cold-start, serial vs parallel fetches, and whether the loader awaits all data before painting.
- Check `public/widget-4.7.31-hostinger.js` bundle size and how the storefront snippet injects it (async/defer, blocking script, position in `<head>` vs end of `<body>`).
- Check `useFetchChatSettings` + `useFetchStoreBranding` in `widget/src/app/hooks/` — if the bubble waits on both before mounting, that's the stall.

Fixes (apply the ones that match findings):
- Render the launcher bubble synchronously from the loader script using cached/default config (logo, color, position) so it shows in < 200ms; hydrate real config in the background and reconcile.
- Make `widget-config` and `widget-resolve` calls parallel (`Promise.all`) and add a short in-memory + `localStorage` cache keyed by `tenant_id` so repeat visits paint instantly.
- Ensure the loader `<script>` tag is `async` and that the IIFE doesn't block on the full React bundle before showing the launcher (split: tiny loader paints bubble → lazy-loads chat window on click).
- Set `Cache-Control: public, max-age=300, stale-while-revalidate=86400` on `widget-config` for anon reads.
- Preconnect to the Supabase functions origin from the loader.

### 4. Rebuild widget bundle

- I edit `widget/` source, not the minified file.
- Build: `cd widget && bun install && bun run build`.
- Copy `widget/dist/widget.js` → `public/widget-4.7.32-hostinger.js`.
- You upload that to `https://widget.fuqah.net/widget.js` (the build does not auto-publish to Hostinger).

### Out of scope

No dashboard layout changes, no new tables, no edge function rewrites beyond what's needed for #2 and #3.
