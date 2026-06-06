## Make AI links clickable in Test Chat

In `src/app/components/settings/TestChat.tsx`, AI replies are rendered as plain text inside a `<span className="whitespace-pre-wrap">{msg.text}</span>`. URLs come through as text and are not clickable.

### Change

1. Add a small inline renderer in `TestChat.tsx` (or a tiny helper component co-located in the same file) that splits `msg.text` on URL matches and renders:
   - text segments as-is (preserve `whitespace-pre-wrap`)
   - URL segments as `<a href={url} target="_blank" rel="noopener noreferrer nofollow">` styled blue + underline on hover

2. URL detection regex: match `https?://...` and bare `www....` (prepend `https://` for the href in the `www.` case). Trim common trailing punctuation `.,;:!?)` so a link at end of a sentence doesn't include the period.

3. Replace the `<span className="whitespace-pre-wrap">{msg.text}</span>` for AI bubbles (and user bubbles too, for symmetry) with the new renderer. Keep the surrounding bubble styles unchanged.

4. Styling: use a token-friendly class like `text-sky-400 underline underline-offset-2 hover:text-sky-300 break-all` for AI bubbles (dark background), and `text-[#043CC8] underline` for user bubbles (light background). RTL/Arabic mixed with LTR URLs handled via `dir="ltr"` on the anchor + `unicode-bidi: isolate` so the URL doesn't reverse.

### Out of scope

- No markdown rendering (no `react-markdown`) — keeping the change minimal.
- No changes to the storefront widget or other chat surfaces.
- No backend changes.