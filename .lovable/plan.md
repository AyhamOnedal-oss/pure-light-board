# Auto-close widget on idle (rating screen)

## Problem

When the rating screen stays open and the customer goes idle, the backend's `auto-close-stale-conversations` marks the conversation as `closed` in the dashboard, but the widget UI keeps showing the rating screen indefinitely. The user expects the widget to behave exactly as if "تخطي وإغلاق" was tapped: close + clear messages + open a fresh new chat next time.

Root cause: in `widget/src/app/components/ChatWindow.tsx` (line 670), `inactivitySeconds={0}` is hardcoded on `<RatingScreen>`, which disables the rating-screen auto-close entirely. The comment notes it was disabled because a previous countdown was too aggressive.

## Fix

In `widget/src/app/components/ChatWindow.tsx`, on the `<RatingScreen>` instance:

1. Replace `inactivitySeconds={0}` with the real setting from `themeSettings.ratingInactivitySeconds` (already plumbed via `useFetchChatSettings`, default 900s = 15 min). This matches the server-side idle cutoff so dashboard + widget stay consistent.
2. Implement `onRatingAutoClose` instead of leaving it a no-op:
   - `trackEvent('rating.auto_closed', evCtx())`
   - `closeConversation(evCtx(), 'inactivity')` so the close reason persists as "الخمول"
   - `RatingScreen` already calls `onClose()` right after `onRatingAutoClose()`, and `onClose` (passed from `WidgetChatPage`) clears messages and generates a new `conversationId` — same behavior as Skip.

No backend, dashboard, or schema changes. No edits to `RatingScreen.tsx` (the auto-close timer + handler wiring already exist there).

## Verification

- Open widget → trigger rating screen (e.g. AI close or manual close) → wait `ratingInactivitySeconds` → widget collapses, messages cleared, reopening starts a brand-new conversation.
- Dashboard conversation row shows `status=closed`, `close_reason=inactivity`.
- Submitting or tapping "تخطي وإغلاق" still works unchanged.

## Out of scope

- The standalone `widget-*.js` Hostinger bundle (separate file the user maintains; they upload patched versions manually).
- Server-side auto-close logic (already correct).
