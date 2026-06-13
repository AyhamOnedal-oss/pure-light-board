# Rating comment still missing — diagnosis & next step

## What I verified
- All three fixes from the previous turn are present in code:
  - `widget/src/app/utils/analytics.ts` → `postRating` now forwards `comment` (mapping `feedback` → `comment`, trims, sends `null` for empty).
  - `widget/src/app/components/ChatWindow.tsx` → `onRatingSubmit` calls `postRating(evCtx, { stars, comment: fb.trim() || undefined })`.
  - `supabase/functions/widget-events/index.ts` → accepts `payload?.comment ?? payload?.feedback`, trims, stores `NULL` for blank.
- I queried the DB for conversation `4e622870`: `csat_rating = 4`, `rating_comment = NULL`. So the comment never reached the server for that test.

## Why the user's test still shows NULL
The storefront widget runs inside an iframe whose `src` is built in `supabase/functions/widget-loader/index.ts`:

```
iframe.src = APP_BASE_URL + "/widget/chat?..."
```

`APP_BASE_URL` defaults to `https://pure-light-board.lovable.app` — the **published** Lovable URL, not the live preview. So even when the merchant tests inside the dashboard preview, the chat iframe loads the **last published** widget bundle, which still contains the old `feedback`-key payload. The edge function then drops the comment because `payload.comment` is undefined.

## Action required
**Publish the project.** Once published, the next rating with written feedback will store `rating_comment` and the yellow comment bar will appear in the conversation view. No further code changes are needed.

## Optional verification after publish
1. Open the storefront / test page, send a few messages, close the chat, give 4 stars, type a comment in Arabic, submit.
2. Open the conversation in the dashboard — the yellow bar with the comment should appear between the header pills and the chat bubbles.
3. (Optional DB check) run:
   ```sql
   SELECT id, csat_rating, rating_comment
   FROM conversations_main
   ORDER BY updated_at DESC LIMIT 5;
   ```
   to confirm new rows have `rating_comment` populated.

## Out of scope
- Past ratings (including the `تعامل جيد` one) cannot be recovered — the widget never sent the comment, so it isn't stored anywhere.
- No further code edits needed; this turn is purely a "publish and re-test" action.
