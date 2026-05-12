## Goal
Make the widget build a single self-contained `widget.js` so deploying to Hostinger only ever requires uploading one file.

## Why
Today `bun run build` in `/widget` outputs two files:
- `widget/dist/widget.js`
- `widget/dist/widget.css`

The bundle injects `<link href=".../widget.css">` at runtime (visible in your console: `[Fuqah] CSS link injected: https://widget.fuqah.net/widget.css`). When you upload only `widget.js`, the storefront keeps loading the **old** `widget.css`, so visual fixes (like the country-flag alignment) never appear in Zid even though they look right in Figma/preview.

## Changes

### 1. `widget/vite.config.ts`
Switch the library build so CSS is inlined into the JS bundle instead of emitted as a sibling file:
- Set `build.cssCodeSplit: false` (already set) **and** add a small Vite plugin (or use `build.rollupOptions.output.assetFileNames` + a post-build inline step) so the generated CSS is injected as a `<style>` tag by `widget.js` at runtime.
- Cleanest approach: install `vite-plugin-css-injected-by-js` and add it to `plugins`. It rewrites the build so all CSS becomes a `style.textContent = "..."` call inside `widget.js`. No more `widget.css` emitted.

### 2. Remove the manual CSS `<link>` injection
The current widget code injects `https://widget.fuqah.net/widget.css` at boot. With CSS inlined, this is no longer needed and would 404 after we stop uploading the file.
- Locate the line that injects the CSS link (the one producing the `[Fuqah] CSS link injected` log) inside the widget bundle source and delete it. Likely lives in `widget/src/main.tsx` or a bootstrap helper.

### 3. Verify
- Run `bun run build` in `/widget`.
- Confirm `widget/dist/` now contains only `widget.js` (plus maybe a sourcemap) — no `widget.css`.
- Open the built file and grep for the country-selector styles to confirm the CSS is inlined.

### 4. Deploy instructions (for you, after I implement)
1. Upload the new single `widget/dist/widget.js` to Hostinger, overwriting the old one.
2. (Optional cleanup) Delete the old `widget.css` from Hostinger so any cached reference 404s loudly instead of silently serving stale styles.
3. Hard refresh the Zid storefront. Country flag should now match Figma.

## Out of scope
- No changes to widget UI / layout code.
- No changes to the Supabase loader (`widget-loader/index.ts`) — it already only references `widget.js`.
- Dashboard, auth, and database untouched.
