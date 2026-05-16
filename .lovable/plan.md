## Plan

Keep the flag in the ticket phone field — just fix the visual shift/distortion. I will rebuild the flag rendering on a solid, well-known approach instead of the hand-drawn inline SVG.

## Root cause

In the uploaded Hostinger `widget-v3.7.0.js`, the flag is drawn with custom inline SVG paths inside a wrapper that gets stretched by the parent flex row (`fq-phone-row` has `height:44px` and the button has `height:100%`). Even with `preserveAspectRatio`, the wrapper picks up host page CSS resets and ends up shifted up and squished. This is why your screenshot still shows a tilted/clipped flag.

## Fix

1. **Use a stable flag library**
   - Embed `flag-icons` (the standard CSS sprite-based flag set used across phone-input libraries) directly into the widget bundle so Hostinger needs no extra files.
   - Inline its CSS + base64 SVG sprites into `FQ_INLINE_CSS` so the widget stays a single self-contained `widget.js`.

2. **Replace `flagSVG()` rendering**
   - Render flags as `<span class="fq fq-kw">` (or equivalent) with fixed dimensions.
   - Wrap in a locked-size box: `width:22px; height:16px; flex:0 0 22px; display:inline-block; background-size:cover; background-position:center;`.
   - Apply `!important` on critical layout props so host page CSS (Salla/Zid themes) cannot shift it.

3. **Apply to both ticket UIs**
   - Inline ticket form inside chat (around lines 927–1045).
   - Full create-ticket screen (around lines 1518–1680).
   - Also fix the country dropdown items so flags there render identically.

4. **Keep everything else intact**
   - Country selection, dial code, validation, submission via `widget-events` edge function — all unchanged.
   - Version bumped to `3.7.1`.

5. **Deliverables for Hostinger**
   - `widget.js` — corrected production file (single file, no extra assets needed).
   - `widget-v3.7.1.js` — versioned backup.
   - `widget-v3.7.1-notes.md` — short deployment notes.

## Result

The Kuwait flag (and every other country flag) will render at a fixed 22×16 box, perfectly centered next to `KW ▾`, with no shift, no distortion, no clipping — even inside Salla/Zid themes.