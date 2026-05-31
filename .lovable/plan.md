## What I found

- The classifier is now working. The latest `لا شكراً`-style message was classified as `end_conversation` with confidence `0.9`.
- Token usage for that classifier call: `258` prompt tokens + `13` completion tokens = `271` total tokens.
- Estimated cost for that call: about `$0.000031`.
- There is still one backend bug in `chat-ai`: `logClassifier()` still references the removed constant `CLASSIFIER_MODEL_PRIMARY`, which can throw `ReferenceError: CLASSIFIER_MODEL_PRIMARY is not defined` when a verdict is null.
- The screenshot shows the backend final reply is reaching the widget, but the current visible widget is not reliably switching to the rating screen. This likely means the deployed/uploaded `widget.js` is stale, or the frontend needs a safer fallback for final-close replies.

## Plan

1. Fix `chat-ai` backend
   - Replace the stale `CLASSIFIER_MODEL_PRIMARY` reference with `CLASSIFIER_MODEL`.
   - Keep `gpt-4.1-nano`, `3000ms` timeout, and classifier-only behavior.
   - Redeploy the `chat-ai` Edge Function immediately.

2. Add a small widget-side safety net
   - Keep using `action.type === "offer_close_done"` as the primary trigger.
   - Add a fallback that treats clear final replies like `شكراً لتواصلك معنا` / `يومك سعيد` as close-done, so rating still appears even if an older backend response misses the action field.
   - Do not add keyword shortcuts before the classifier; this stays classifier-driven as requested.

3. Build and provide the updated widget file
   - Build the widget bundle.
   - Copy the generated `widget.js` to `/mnt/documents/widget.js` so you can download and re-upload it.

4. Verify
   - Test the deployed `chat-ai` function with a clear close message such as `لا شكراً` and confirm it returns `action.type = "offer_close_done"`.
   - Confirm classifier usage has non-zero tokens and cost.
   - Confirm there are no more `CLASSIFIER_MODEL_PRIMARY is not defined` errors in function logs.