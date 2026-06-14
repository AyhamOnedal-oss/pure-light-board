## Goal

Restore the storefront widget to a known-good state and reapply the recent fixes carefully, so the regressions you're seeing (thumbs up disappearing, rating screen not auto-closing) go away — without losing the 4.7.31 layout/bottom-bar fix or the "no idle while ticket raised" behavior.

## Approach

Overwrite `public/widget-4.7.31-hostinger.js` with the contents of `public/widget-4.7.30-hostinger.js` as a baseline, then add back only the four changes we actually want, plus the two bug fixes.

## Changes reapplied on top of 4.7.30

1. **Bottom-bar anchor (desktop sizing)** — same delta as 4.7.31:
   - `_bottomGap = state.bottomOffset > 0 ? state.bottomOffset : 20` (anchor to bar, no 90px floating gap)
   - `_h` clamps to `Math.max(240, _avail)` when space is tight, else `Math.min(_desired, _avail)`
   - Set `minHeight: 0` and `maxHeight: 580px` so the inline `max-height` CSS rule can't clip
2. **lockBody mobile-only** — keep `if (!isMobile()) return;` early-out so desktop scroll isn't frozen.
3. **No idle while ticket raised** — keep the existing `state.ticketCreated` gates in the inactivity timers (already present in 4.7.30; verify they survive).
4. **Rating idle = skip-close** — re-add `settings.ratingInactivitySeconds` (default 900), `state.ratingInactivityTimer`, the `rating_inactivity_seconds` settings parser, the timer set inside `renderRatingScreen` that calls `restCloseConversation('rating_skip')` + `resetConversationForNextOpen()`, and the cleanup `clearTimeout`s in `renderChatScreen`, `resetConversationForNextOpen`, and `fullClose`.

## Bug fixes (the regressions you reported)

### Thumbs up disappears after sending another message

Root cause: `buildFeedback(msgId)` stores the chosen value only in a local closure (`feedbackState = { value: null }`). Any time the message list is rebuilt (new message append that triggers a re-render, polling refresh, screen switch back), the closure is recreated and the UI shows the default unselected state.

Fix:
- Add `state.messageFeedback = {}` keyed by `msgId`.
- In `buildFeedback(msgId)`, initialize `feedbackState.value = state.messageFeedback[msgId] || null` and call `updateFeedbackUI()` once before returning so the saved choice paints immediately on rebuild.
- In both onclick handlers, also persist: `state.messageFeedback[msgId] = feedbackState.value;`
- Clear `state.messageFeedback = {}` inside `resetConversationForNextOpen()` and `fullClose()` so a fresh conversation starts clean.

### Rating screen doesn't auto-close after idle

Two issues to address together:
- The 4.7.31 default of 900s (15 min) is likely longer than you've been waiting. Lower the built-in default to **120s** so behavior matches the dashboard's typical setting, and the dashboard value still overrides via `rating_inactivity_seconds`.
- Verify the parser key matches what `chat_settings` actually saves. If the column is named differently (e.g. `rating_inactivity_close_seconds`), add a second fallback in the settings parser so both keys map to `settings.ratingInactivitySeconds`. I'll confirm the exact column name during implementation and wire whichever key(s) are present.
- Make the timer robust: re-arm it on every entry to `renderRatingScreen` (already does) and ensure no early `clearTimeout` happens from an unrelated `renderChatScreen` call during the rating screen's lifetime — guard the cleanup in `renderChatScreen` so it only clears when actually leaving rating (`if (state.currentScreen !== 'rating')`).

## Out of scope

- No changes to React widget (`widget/src/app/components/*`), dashboard UI, or ChatCustomization settings model.
- No version bump beyond keeping `4.7.31` — only the file body changes.

## Verification

1. Open storefront, send a message, click 👍 on AI reply, send another message → thumb stays filled.
2. Send a message, click 👎, reopen widget after `resetConversationForNextOpen` → thumbs are reset (fresh convo).
3. Reach rating screen, wait the configured idle time → widget slides down (same as تخطي وإغلاق), next open starts fresh conversation.
4. Raise a ticket → no idle prompt, no rating screen, widget stays open.
5. Desktop with Hostinger bottom bar → window anchors to bar with no clipping, no 90px gap.