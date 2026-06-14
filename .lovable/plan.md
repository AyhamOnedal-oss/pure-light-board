## Two widget fixes — both delivered as a new Hostinger bundle

### Issue 1 — Idle close must collapse the widget (not show rating)

The earlier fix only touched the React source (`widget/src/app/components/ChatWindow.tsx`). The Hostinger storefront loads `public/widget-4.7.26-hostinger.js`, which still has the old behavior:
- `inactivitySeconds: 0` on the RatingScreen (auto-close disabled)
- `onRatingAutoClose: () => {}` (no-op)
- Chat-level inactivity close-timer routes to the rating screen instead of collapsing

**Fix (bundle + source, kept in sync):**
1. When the chat-inactivity close-timer fires, skip the rating screen entirely and call `onClose()` so the widget collapses — same effect as "تخطي وإغلاق", next open starts a fresh conversation. The server already marks the row `closed/inactivity`.
2. As a safety net, also wire the RatingScreen idle timer in the bundle (`inactivitySeconds = themeSettings.ratingInactivitySeconds ?? 900`, `onRatingAutoClose` → `trackEvent('rating.auto_closed') + closeConversation('inactivity') + onClose()`), in case the rating screen is reached by some other path.
3. Ship as `public/widget-4.7.27-hostinger.js` with banner bumped to 4.7.27. User uploads it to Hostinger and hard-refreshes.

### Issue 2 — Thumbs up/down disappearing after sending a new message

Reading the code, every `setMessages` call preserves prior messages (`prev => [...prev, new]` or `prev.map(...)`), and `<ChatMessage key={msg.id}>` is stable — so the regression isn't obvious from static reading. I need to reproduce it live before patching.

**Plan:**
1. Open the preview's test chat, send a message, give the AI reply a thumbs-up, then send another message. Watch the React state in DevTools / console-log `messages` to see whether `feedback` is wiped on the AI message or only visually hidden.
2. Likely suspects to verify in order:
   - The AI message `id` changes between renders (e.g. `result.aiMessageId` is set on the second reply for an older message, or the same `Date.now()+1` collision wipes the prior one).
   - A re-mount of `ChatMessage` because something upstream changes its key (e.g. `conversationId` swap from backend triggers re-keying).
   - A stale closure in `onFeedbackChange` overwrites with `null`.
3. Apply the minimal fix to the source (`widget/src/app/components/ChatMessage.tsx` or `ChatWindow.tsx`) and mirror it in the standalone bundle.
4. Verify thumbs survives sending 2-3 more messages, then survives a reload (note: persistence across reloads is out of scope unless you want it).

### Deliverable

- Updated `widget/src/app/components/ChatWindow.tsx` (and possibly `ChatMessage.tsx`) for both fixes.
- New `public/widget-4.7.27-hostinger.js` with both fixes baked into the minified bundle.
- A short note on which lines were patched in the bundle so future edits stay traceable.

### Out of scope

- Persisting thumbs feedback across page reloads.
- Backend / dashboard changes.
- Touching the rating-screen UI itself.