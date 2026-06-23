## Diagnosis (no repo code change needed)

The Hostinger file at `widget.fuqah.net/widget.js` is already the fixed v4.7.34 (verified: `maxLength = 115`, `0/115` counter, `restSubmitRating(state.rating, fb || null)`).

The reason Salla still shows the old behavior is a CDN cache split. Hostinger caches each URL separately, including the query string:

| URL | Used by | What CDN currently serves |
| --- | --- | --- |
| `widget.js?v=1` | Zid storefront | New file (counter + comment fix) ✅ |
| `widget.js?v=46` | Salla storefront | Old cached file ❌ |

When the user uploaded the new file, only the `?v=1` cache entry was refreshed (because they tested with that URL). The `?v=46` entry kept serving the pre-fix copy.

## Fix — done outside this repo

The actual fix lives in the Salla theme snippet, not in this codebase. One of:

1. **Bump the version token** in the Salla theme's snippet:
   ```html
   <script src="https://widget.fuqah.net/widget.js?v=4734" ...></script>
   ```
   New URL → CDN cache miss → fresh fetch of the fixed file. Easiest, takes ~1 minute.

2. **Or purge the Hostinger CDN** for `widget.js?v=46` from the Hostinger control panel.

Either makes Salla match Zid immediately.

## Optional in-repo follow-up

Update `widget/README.md` and `INTEGRATION_EXAMPLE.md` to recommend always bumping `?v=…` after each Hostinger upload, to avoid this exact split happening again next time. This is documentation-only — no behavior change.

## Long-term

Migrate Salla off Hostinger onto the Supabase `widget-loader` (prior approved plan). Then there's no third-party CDN cache to manage and Salla/Zid stay in lockstep automatically.