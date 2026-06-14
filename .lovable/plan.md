## Root cause (confirmed)

Edge-function logs prove the rating arrives with `has_comment: false, comment_len: 0`. The Hostinger widget bundle hardcodes an empty string when it submits:

```js
// widget-4.7.25-hostinger.js, line 2010
submitBtn.onclick = function () {
  if (state.rating === 0) return;
  restSubmitRating(state.rating, '');   // ← always blank, ignores the textarea
  ...
};
```

The textarea `oninput` does write `state.feedback = this.value` (line 1992), but the submit handler never reads it. So the comment never leaves the customer's browser. The dashboard, backend, RLS, and realtime are all already correct — the bar has nothing to render because the column is `NULL`.

## Fix (single file: `widget-4.7.25-hostinger.js`)

1. **Send the comment.** Replace line 2010 with:
   ```js
   var commentText = (state.feedback || ta.value || '').trim();
   restSubmitRating(state.rating, commentText.length ? commentText : null);
   ```
   This reads from both `state.feedback` (kept by `oninput`) and the live `ta.value` as a fallback, trims whitespace, and sends `null` for blanks (matching what the backend already normalises to `NULL`).

2. **Bump the version banner** at the top of the file from `4.7.22` to `4.7.26` so cache busting is obvious on the next upload and we can confirm in browser DevTools that the new bundle is live.

3. **(Optional belt-and-braces)** Inside `restSubmitRating`, guard against the legacy `''` case so any other call site stays safe:
   ```js
   var safeComment = typeof comment === 'string' && comment.trim().length
     ? comment.trim().slice(0, 1000)
     : null;
   // then send safeComment in payload.comment
   ```

That's the entire code change. No backend, dashboard, or schema edits are needed — `widget-events` already writes `rating_comment`, and `ConversationsPage` already renders the yellow-star bar reactively whenever `selected.ratingComment` is non-empty.

## Verification

1. Upload the patched `widget-4.7.25-hostinger.js` (renamed `widget-4.7.26-hostinger.js`) to `widget.fuqah.net/widget.js`, hard-refresh the storefront.
2. Open the chat, end conversation, rate (e.g.) 5 stars, type "تجربة فُقاهة"، press إرسال التقييم.
3. Check edge-function logs for `widget-events rating` — expect `has_comment: true, comment_len > 0, updated: 1`.
4. Open the dashboard's Conversations page → the yellow ★ + quoted comment bar appears above the conversation header without needing a refresh.
5. Repeat the test submitting the rating with an empty textarea — the bar must stay hidden.

## Out of scope / no change required

- React widget under `widget/src/*` already sends the comment correctly — no edits.
- `supabase/functions/widget-events/index.ts` — already trims, slices to 1000 chars, and persists `rating_comment`.
- `src/app/components/ConversationsPage.tsx` — already trims and gates the bar render on non-empty content, and re-syncs on realtime UPDATEs.

Approve this and send the next batch of edits you want stacked onto the same bundle and I'll apply them together.
