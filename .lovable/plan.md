Edit the uploaded `widget-4.7.16-hostinger (1).js` (the real 150KB Hostinger build, not the React bundle) to add multi-line message splitting, and return the patched file as `widget-4.7.17-hostinger.js`.

## What changes

In the widget script, only the `doSend()` function (around line 1500) changes. Everything else stays identical.

New behavior:
- Take the textarea value and split it on `\n`.
- Trim each line, drop empty lines.
- If 0 lines and no attachment: do nothing (same as today).
- If 1 line (or attachment only): send as a single message (same as today).
- If 2+ lines: send each line as its own customer message, sequentially. The attachment is attached to the first line only. The next line is only sent after the previous one's AI reply comes back, so order is preserved both in the widget UI and in the dashboard.

Also bump the header version comment from `4.7.16` to `4.7.17` with a note about multi-line splitting.

## Technical detail

- Extract the existing single-send logic into a helper `sendOne(text, att, onDone)` that pushes the customer message, calls `sendToBackend`, then runs `onDone` after the AI reply is appended.
- `doSend()` clears the textarea/attachment UI immediately, then either calls `sendOne` once or iterates a queue calling `sendOne(line, att-on-first-only, next)`.
- No changes to `sendToBackend`, ticket flow, rating flow, typing indicator, keydown handler, or any other code path.
- Output file written to `/mnt/documents/widget-4.7.17-hostinger.js` and delivered as a download artifact.

## Out of scope

- No changes to the React app, dashboard, or `chat-ai` edge function.
- No changes to the Lovable project source — this only patches the standalone Hostinger embed JS you uploaded.