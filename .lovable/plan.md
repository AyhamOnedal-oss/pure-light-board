# Plan: Widget image compression + newline preservation

## 1. Client-side image compression in the widget (~150 KB target)

File: `widget/src/app/components/ChatInput.tsx`

In `handleFileSelect`, when the picked file is an image, downscale it before turning it into an attachment:

- Load the file into an `Image` via `URL.createObjectURL`.
- Draw onto a `<canvas>` resized so the **longest side = 1024 px** (keep aspect ratio; never upscale).
- Re-encode as `image/jpeg` at quality `0.72` (tuned for the ~150 KB phone-photo target).
- If the original was already smaller than ~200 KB, keep it as-is (skip recompression).
- Replace the attachment `url` with the compressed blob URL, and store the compressed blob/size on the attachment so the rest of the pipeline (send → base64 → edge function → vision) uses the small version.

Non-images (PDF/doc/txt) are untouched.

Expected: typical 4–6 MB phone photo → ~120–180 KB. Upload time drops from seconds to <300 ms; OpenAI vision quality at `detail: "low"` is unaffected (it downsamples to 512 px internally anyway).

## 2. Newline preservation (the `السلام عليكم \n\n وين طلبي` → one line bug)

Two independent issues are stripping the newlines today.

### 2a. Stop splitting the textarea into multiple messages

File: `widget/src/app/components/ChatInput.tsx`, function `doSend`.

Currently it does `raw.split(/\r?\n/).map(trim).filter(non-empty)` and either sends each line as a separate `onSendMessage` call or collapses them. That's what eats the blank line and reflows the text.

Change it to send the **raw trimmed text as a single message**, newlines intact:

```
const text = message.replace(/\s+$/g, ''); // trim only trailing whitespace
if (!text && !attachment) return;
onSendMessage(text, attachment || undefined);
```

### 2b. Render bubbles with `white-space: pre-wrap`

File: `widget/src/app/components/MessageTextWithLinks.tsx`

The `<p>` style currently has no `whiteSpace`, so the browser collapses `\n` to a space. Add `whiteSpace: 'pre-wrap'` to the root `<p>` style. URL splitting still works because the regex doesn't consume newlines.

### 2c. Dashboard TestChat send path

File: `src/app/components/settings/TestChat.tsx`

The render side already uses `whitespace-pre-wrap` (line 301). Verify the send path doesn't strip `\n` before insert into `conversations_messages.body` / before POST to `chat-ai`. If any `.trim()` / `.replace(/\s+/g, ' ')` is applied to `input`, change it to only trim leading/trailing whitespace (`text.replace(/^\s+|\s+$/g, '')`).

## 3. Out of scope (explicit)

- No edge-function changes.
- No DB migration — `conversations_messages.body` is `text` and already stores `\n` fine; only client rendering was at fault.
- Vision model / latency optimizations from the previous plan are **not** part of this change.

## Technical notes

- Compression helper lives inline in `ChatInput.tsx` (small enough; no new file).
- Canvas approach is fully synchronous-ish and works in all widget target browsers; no extra dependency.
- Send button stays disabled while compression is running (reuse `isDisabled` + a local `compressing` state).
