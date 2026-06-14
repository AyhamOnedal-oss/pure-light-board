## Goal

Produce a new Hostinger-ready widget file `widget-4.7.32-hostinger.js` (based on your uploaded `widget-4.7.31-hostinger (2).js`) with two changes applied, saved to `/mnt/documents` so you can download it and push to `https://widget.fuqah.net/widget.js`.

## Changes to apply inside the IIFE

### 1. Rating feedback: 115-char limit + transparent counter

Locate the rating screen builder (the function that renders the stars + feedback textarea after a conversation ends). Apply:

- Add `maxLength = 115` attribute to the feedback `<textarea>`.
- On `input`, clamp `value` to 115 chars.
- Insert a small counter element positioned at the bottom-left **inside** the textarea wrapper:
  - text: `{len}/115`
  - styles: `position:absolute; bottom:6px; left:10px; font-size:11px; opacity:.45; pointer-events:none; font-family:inherit;`
  - color flips to `#ef4444` and opacity to `.8` when `len >= 110`.
- Ensure the textarea wrapper has `position:relative` and a bit of bottom padding (`padding-bottom:18px`) so the counter doesn't overlap typed text.
- RTL-safe: when locale is Arabic, swap `left:10px` → `right:10px`.

### 2. Instant render (kill the ~13s delay)

In the bootstrap section (the part that fetches `widget-resolve` + `widget-config` before painting), add a localStorage cache so repeat visits paint the bubble in <200ms:

- Cache key: `fuqah_widget_cache_{platform}_{external_id}` storing `{ tenant_id, cfg, ts }`.
- On boot: if cache exists, immediately call the existing mount/render with cached `tenant_id` + `cfg`. Mark `mounted = true`.
- In parallel, still fire `widget-resolve` → `widget-config`. When fresh data arrives:
  - Write it back to localStorage.
  - If `!mounted`, mount now.
  - If mounted, diff against cached visual keys (`bubble_visible`, `position`, `bubble_offset_x/y`, `bubble_size`, `widget_outer_color`, `widget_inner_color`, `welcome_bubble_enabled`, `welcome_bubble_line1/2`, `auto_open_delay`, `logo_url`, `icon_url`). Only re-mount if a visual key changed.
- Add `<link rel="preconnect">` injection for the Supabase functions origin at the very top of the IIFE so the first network call is faster on cold visits too.
- Run `widget-resolve` + `widget-config` with `Promise.all` style (resolve still has to come first since config needs `tenant_id`, but config + branding fetches inside the script run in parallel where applicable).

No other behavior changes — header text, footer, ticket flow, thumbs feedback, idle close, and bottom-bar anchoring all stay exactly as 4.7.31.

## Header bump

Update the top comment block to:

```
* Version: 4.7.32 (Hostinger embed: + 115-char feedback limit with counter;
*                  + instant render via localStorage cache;
*                  + preconnect to Supabase functions origin)
```

## Deliverable

- File: `/mnt/documents/widget-4.7.32-hostinger.js` (full 2932+ line script with the edits above).
- Presented via `<presentation-artifact>` so you can click to download, then upload to Hostinger as `widget.js`.
- No changes to the React `widget/` workspace in this step — this is purely the standalone Hostinger embed file.

## Out of scope

- No dashboard changes.
- No edge-function changes (the loader/config edits from the previous round already shipped; this Hostinger file is a separate, self-contained script that doesn't go through `widget-loader`).
- No new versions of `public/widget-*.js` in the repo unless you ask.
