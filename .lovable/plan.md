## Two bugs, same file

Both issues live in the deployed Hostinger widget (`public/widget-4.7.*-hostinger.js`, served from `widget.fuqah.net/widget.js`). The React widget (`widget/src/app/components/RatingScreen.tsx`) already does both things correctly — Hostinger fell out of sync.

### Bug 1 — rating comment never sent

`public/widget-4.7.33-hostinger.js` line 2087:
```js
restSubmitRating(state.rating, '');   // hardcoded empty
```
Customer text is captured into `state.feedback` (line 2069) but discarded on submit, so `rating_comment` in `conversations_main` is always `NULL` and the dashboard's yellow quote bar (`ConversationsPage.tsx` line 556) never renders.

### Bug 2 — missing 115-character counter

The React `RatingScreen` shows a live `feedback.length/115` counter and caps input with `maxLength={115}`. The Hostinger textarea block (lines 2060–2071) has neither.

## Fix

1. Copy `public/widget-4.7.33-hostinger.js` → `public/widget-4.7.34-hostinger.js`.
2. In the new file, in the textarea block (~lines 2060–2071):
   - Make `textareaWrap` `position:relative`.
   - Set `ta.maxLength = 115`, increase `padding-bottom` to ~22px so text doesn't sit under the counter.
   - Append a counter `<div>` styled `position:absolute;bottom:8px;left:12px;font-size:11px;font-weight:500;opacity:.55;pointer-events:none;font-variant-numeric:tabular-nums;` starting at `0/115`.
   - Update `oninput` to slice to 115, write back to the textarea, and update the counter (red `#ef4444` at ≥110).
3. Replace line 2087:
   ```js
   var fb = (state.feedback || '').trim();
   restSubmitRating(state.rating, fb || null);
   ```
4. No backend, dashboard, or React-widget changes — all three are already correct.

## Deliverable

A single new file `public/widget-4.7.34-hostinger.js` ready for the user to upload to Hostinger as `widget.js`. Older versions left untouched for cache continuity.

## Verification

After Hostinger replaces `widget.js` with v4.7.34:
- Salla tenant `d49382a6-…`: rate 4★ + comment → `conversations_main.csat_rating=4`, `rating_comment` populated → dashboard shows the quote bar.
- Zid store: same flow, same result.
- Typing in the textarea shows live `N/115` counter, turns red at ≥110, blocks input past 115.
- Empty-comment submit → only `csat_rating` set; no quote bar (unchanged).

## Out of scope

- Uploading the file to `widget.fuqah.net/widget.js` (manual Hostinger deploy step).
- Moving Salla storefronts off Hostinger onto the Supabase `widget-loader` (separate prior plan; the proper long-term fix so Salla and Zid share the same React widget and these bugs can't diverge again).