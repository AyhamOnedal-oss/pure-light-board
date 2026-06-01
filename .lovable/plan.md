## Goal
When the user types a message containing line breaks (Shift+Enter) in the widget, each non-empty line should be sent as its own message — visible as separate bubbles in the widget AND stored as separate messages in the dashboard / backend. Today the whole multi-line text is sent as one message.

## Scope
Frontend widget only (`widget/`). No backend / Supabase changes — the existing `chat-ai` edge function already records one message per call, so simply calling it once per line gives separate rows in the dashboard automatically.

## Changes

### 1. `widget/src/app/components/ChatInput.tsx`
- In `doSend`, split `message.trim()` on `\n`, trim each line, drop empties.
- If there is no attachment and 2+ lines: call `onSendMessage(line)` for each line sequentially (no attachment on the extra lines).
- If there is an attachment: attach it to the first line only; remaining lines go as plain text messages.
- Single-line case: behaves exactly as today.
- Clear input/attachment and reset textarea height once after dispatching all lines.

### 2. `widget/src/app/components/ChatWidget.tsx`
- `handleSendMessage` becomes serialized so consecutive calls don't race: await the previous call's AI response before sending the next line (so the dashboard/AI sees them in order, and the typing indicator behaves correctly per line).
  - Implement with a small in-component promise queue (`pendingRef.current = pendingRef.current.then(() => actuallySend(text, attachment))`).
- No change to message shape; each line is just another customer message + its AI reply, exactly like today.

### Out of scope
- No edits to `chat-ai`, dashboard `ConversationsPage`, or the loader. Each call already lands as its own row, so the dashboard splits automatically.
- No change to how the AI agent receives history — it still gets the last 10 messages per call.

## Technical notes
- Empty lines (e.g. user pressing Shift+Enter twice) are skipped to avoid blank bubbles.
- Sequential dispatch keeps `isTyping` accurate and avoids hitting rate limits in a burst.
- After this change, the widget JS bundle must be rebuilt (`cd widget && bun run build`) and re-uploaded to `widget.fuqah.net/widget.js` — this is a manual deploy step the user already follows for the 150 KB bundle.
