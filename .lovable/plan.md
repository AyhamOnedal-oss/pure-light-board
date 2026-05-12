## What I have now
- `widget_8.js` (2001 lines) — Figma-correct JS, but still calls `loadCSS()` which `<link>`s `widget.css` from Hostinger.
- `widget_2.css` (899 lines) — the matching v3.0.0 stylesheet.
- `style.css` (small snippet) — extra rules for `.chat-widget-messages-wrapper` / `.chat-widget-messages` (always-white messages area, hidden scrollbar).

## Why we need this fix
As long as `widget.js` injects `<link href=".../widget.css">`, uploading only `widget.js` to Hostinger leaves the storefront serving the **old** cached `widget.css` — which is exactly why your country-flag fix shows in Figma but not in Zid.

## Plan

1. **Build a single `widget.js`** at `/mnt/documents/widget.js` containing:
   - Header bumped to `Version: 3.2.0 (single-file, CSS inlined)` so you can confirm in DevTools which build is live.
   - A top-level constant `FQ_INLINE_CSS` holding the full contents of `widget_2.css` **plus** the `style.css` snippet appended at the end (so the messages-area override wins).
   - `loadCSS()` rewritten to:
     ```js
     var s = document.createElement('style');
     s.setAttribute('data-fuqah','inline');
     s.textContent = FQ_INLINE_CSS;
     document.head.appendChild(s);
     console.log('[Fuqah] Inline CSS injected (' + FQ_INLINE_CSS.length + ' chars)');
     ```
   - No other JS logic touched. Country-flag layout, dropdown, dark-mode etc. stay exactly as you authored them in `widget_8.js`.

2. **Escape safely.** I'll embed the CSS as a single JS string using a safe encoder (escape `\`, backticks, `</script>` sequences). Verified by re-extracting and diffing against the source CSS before delivering.

3. **Deliver one file.** You upload only `/mnt/documents/widget.js` to Hostinger — overwrite the existing `widget.js`. Optionally delete the old `widget.css` from Hostinger so any stale cached `<link>` 404s loudly instead of silently serving old styles.

4. **Verify after upload.** Hard refresh the Zid storefront. Console should show:
   - `[Fuqah] Inline CSS injected (~NNNNN chars)`
   - **No** network request to `/widget.css`.
   - Country flag matches Figma.

## Out of scope
No edits to widget UI/JS behavior, Supabase loader, dashboard, auth, or DB. Pure packaging change.

## Confirm to proceed
Reply "go" and I'll generate the single `widget.js` for download.