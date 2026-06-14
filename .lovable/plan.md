# Plan — widget v4.7.30: don't let the chat window get clipped by the host page

## What's wrong now
On desktop, `updatePositions()` sets `dom.window.style.bottom = (90 + state.bottomOffset) + 'px'`. The CSS height is locked at `580px`. When the host page has a tall sticky bottom bar (~80–90 px like in the screenshots), the window's top edge climbs above the viewport, so the chat header (and the `×` button, hello bubble, etc.) get cut off. The user calls this "floating up and distorted."

## Fix (v4.7.30)
Cap the window's height to the available vertical room above the bottom bar so the chat always fits between the top of the viewport and the bottom bar — never above the viewport.

### Code change (desktop branch of `updatePositions`, ~line 875)
- After setting `dom.window.style.bottom`, compute:
  ```js
  var desired = 580; // default desktop height
  var topGap = 16;   // breathing room from very top of viewport
  var bottomGap = 90 + state.bottomOffset; // already used for bottom
  var available = window.innerHeight - bottomGap - topGap;
  var h = Math.max(360, Math.min(desired, available));
  dom.window.style.height = h + 'px';
  ```
- Recompute on `window` resize and whenever `scanBottomBar()` fires (already calls `updateBubblePosition`; add a parallel `updatePositions()` call when the window is open).

### Guardrails
- Keep mobile branch untouched (it's already fullscreen via CSS `top/bottom: 8px`).
- Minimum height 360 px so the chat never collapses into a sliver.
- Don't change the bottom offset logic — the user explicitly said "follow the شريط below" — only adjust height.

### CSS housekeeping
- Revert the experimental `.fq-chat-window.fq-desktop { bottom: 20px; }` I added in v4.7.28 back to omitting `bottom` (JS owns it). Keeps a single source of truth.

## Deliverable
- `/mnt/documents/widget-4.7.30-hostinger.js`
- Header bumped to `Version: 4.7.30 (Hostinger embed: cap chat window height above bottom bar — no clipping)`
- Verify: file ~170 KB, starts with the proper `/** Fuqah AI Chat Widget` comment, `grep` shows the new height-cap block in `updatePositions`.
