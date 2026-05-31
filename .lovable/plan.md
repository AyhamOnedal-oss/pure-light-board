I’ll correct the widget artifact mix-up by treating the small Hostinger bundle as the only acceptable deliverable.

Plan:
1. Use the existing ~154 KB Hostinger widget line as the baseline, not the ~419 KB generic React/Vite bundle.
2. Re-apply only the latest close-done/rating safety fix into that Hostinger bundle if it is missing.
3. Export a new versioned file, e.g. `widget-4.7.14-hostinger.js`, and also replace `/mnt/documents/widget.js` with that same small file so there is no ambiguity.
4. Verify the final byte size is around 150 KB and confirm it is not the 400 KB bundle before giving you the download link.

Technical note: the current `/mnt/documents/widget.js` is `428252` bytes, while `widget-4.7.13-hostinger.js` is `157057` bytes, so the wrong file was indeed copied to `widget.js`.