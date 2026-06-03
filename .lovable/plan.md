# Plan: ship `widget-4.7.23-hostinger.js`

My previous edits went to the React widget source (`widget/src/...`), but the file you're actually deploying is the standalone vanilla-JS bundle at `/mnt/documents/widget-4.7.22-hostinger.js` (~150 KB, hand-rolled, no build step). It needs the same two fixes applied directly inside that file, then saved as the next version.

## Steps

1. **Copy** `/mnt/documents/widget-4.7.22-hostinger.js` → `/mnt/documents/widget-4.7.23-hostinger.js`.

2. **Newline fix** — inside `FQ_INLINE_CSS` (line 13), add `white-space: pre-wrap;` to the `.fq-msg-text` rule. This makes user and AI bubbles render `\n` and blank lines as real line breaks instead of collapsing to a single space. (`doSend()` at line 1516 already preserves internal newlines as of v4.7.19 — only the CSS was missing.)

3. **Image compression** — replace `fileInput.onchange` (lines 1305–1313) with a handler that, for images >200 KB:
   - Reads the file via `FileReader`.
   - Loads into an `Image` and draws onto a `<canvas>` resized so the longest side is **1024 px** (aspect-ratio preserved, never upscaled).
   - Re-encodes as `image/jpeg` at quality `0.72` via `canvas.toBlob`.
   - Sets `state.attachment` to the compressed blob URL (renames extension to `.jpg`); keeps the original if compression somehow grew the file or failed.
   - Disables the send button while compressing (sets `state.isTyping`-like flag, then `updateSendState()`).
   
   Non-image files and small images (≤200 KB) skip compression. Typical 4–6 MB phone photo → ~120–180 KB.

4. **Version bump** — update the `console.log('[Fuqah] Widget v4.7.21 …')` strings (lines 2641, 2662) to `v4.7.23`, and add a `// v4.7.23 — client-side image compression + pre-wrap newlines` comment near the touched code so the changelog tracks it.

5. **No edits** to edge functions, DB, or the React source — those don't affect what Hostinger serves.

## Deliverable

A single new file: `widget-4.7.23-hostinger.js` in `/mnt/documents/`. You upload it to Hostinger as-is.

## Confirm before I build

- OK to call the new version **`4.7.23`** (matches the "version 23" you mentioned)?
- Compression target ~150 KB via `maxSide=1024, quality=0.72`, skip-if-already-under-200KB — OK, or do you want a different ceiling (e.g. 800 px / quality 0.6 for ~80 KB)?
