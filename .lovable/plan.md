**Goal**

Clarified flow:

- Normal chat: keep current "هل ما زلت معنا؟" inactivity prompt. If user doesn't respond, transition to rating screen → rating idle timer starts → on timeout, close immediately (same effect as tapping `تخطي وإغلاق`).
- Ticket raised: completely skip all idle logic. No "are you there?" prompt, no rating screen, no idle timers. The widget just sits there (or follows existing ticket-created flow) — no auto-close from inactivity.

**Behavior matrix**

| State | "هل ما زلت معنا؟" prompt | Rating screen | Rating idle close |
|---|---|---|---|
| Normal chat, no ticket | Yes (existing) | Yes | Yes — collapse + clear, same as skip button |
| Ticket raised (`ticketCreated === true`) | No | No | N/A |

**Changes**

1. `widget/src/app/components/ChatWindow.tsx`
   - Gate the existing inactivity-prompt `useEffect` (the one that schedules `setShowInactivityPrompt(true)` after `promptSeconds`) with `&& !ticketCreated`. Also clear `showInactivityPrompt` whenever `ticketCreated` flips to true.
   - Gate the auto-close `useEffect` (the one that fires after `closeSeconds` once the prompt is showing) the same way — bail out if `ticketCreated`.
   - When the chat-idle auto-close fires, currently it calls `onClose()` directly. Change it to transition to the rating screen instead (`setCurrentScreen('rating')` + `closeConversation(..., 'inactivity')`), so the rating idle timer is what ultimately closes the widget — matching the user's described flow ("prompt → no answer → rating shows → rating idle → close immediately"). Only do this when `!ticketCreated`.
   - Wire `RatingScreen`'s `onRatingAutoClose` so its effect is identical to the skip button: fire `rating.skipped` + `closeConversation(..., 'rating_skip')` then `onClose()`. Remove the separate `rating.auto_closed` event path so timeout == skip. The widget collapses, messages clear, next bubble click starts a fresh conversation.

2. `widget/src/app/components/RatingScreen.tsx`
   - No structural change. It already calls `onRatingAutoClose?.()` then `onClose()` on timeout — that is the same code path as `handleSkip`. Keep as-is.

3. `widget/src/app/components/InactivityPrompt.tsx`
   - No change. Still rendered for normal chat.

4. `public/widget-4.7.31-hostinger.js` (storefront embed bundle)
   - Mirror the same three gates in the bundled script: skip the "are you there?" prompt and its follow-up close when a ticket is raised, and on rating timeout perform the same close path as the skip button.
   - Bump header comment: "no idle while ticket raised; rating idle = skip-close".

5. Dashboard setting (`src/app/components/settings/ChatCustomization.tsx`)
   - No data-model or label change. Existing `inactivityEnabled`, `inactivityPromptSeconds`, `inactivityCloseSeconds`, `ratingInactivitySeconds` continue to drive the normal-chat path. They are simply ignored once a ticket has been raised.

**Verification on the storefront**

- Send messages, leave idle → prompt appears → ignore → rating screen appears → leave idle → widget collapses immediately (no lingering rating page), reopening starts a brand new conversation.
- Trigger a ticket, then leave the chat idle for longer than the configured idle time → no "are you there?" prompt, no rating screen, no auto-close. The widget stays as the user left it.
- Reach rating screen normally and tap `تخطي وإغلاق` → identical close behavior as the idle path above (visual parity check).