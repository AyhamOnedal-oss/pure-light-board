# Two fixes

## 1) Multi-line input → one merged message (one webhook call)

**File:** `/mnt/documents/widget-4.7.19-hostinger.js` (copy of 4.7.18, patched)

Reverse the v4.7.18 splitting. The widget should:
- Keep accepting newlines in the textarea (Shift+Enter on desktop, Enter on mobile).
- On send, **join all non-empty lines with `\n`** into a single string, render **one customer bubble** (preserving line breaks via `white-space: pre-wrap` already present), and make **one** `sendToBackend` call.
- Remove the `queue` / `sendOneQueued` sequential loop entirely; restore a single `sendOne(text, att)` path that pushes one customer message, sets `isTyping`, calls the backend once, handles intent (`offer_ticket` / `closed`) once.
- Attachment behavior unchanged (attached to that single message).
- Bump header to `Version: 4.7.19 (Hostinger embed: multi-line input sent as one merged message)`.

This eliminates the double webhook call shown in the screenshots. Dashboard will then show one merged bubble with line breaks instead of two rows.

No other widget logic changes.

## 2) Conversation status stays "open" after AI closes it

**Root cause** (verified in `supabase/functions/chat-ai/index.ts`):
When the user-intent classifier returns `end_conversation`, the function returns `intent: "closed"` to the widget and shows the rating screen, **but never updates `conversations_main.status`**. The row stays at `"new"`, so `ConversationsPage.tsx:140` (`isClosed = c.status === 'closed' || 'resolved'`) evaluates false and the dashboard renders "محادثة مفتوحة".

**Fix in `supabase/functions/chat-ai/index.ts`:**
- In the `if (userIntent === "end_conversation")` branch (around line 414), after `persistMessages`, update the conversation row:
  ```ts
  await supabase
    .from("conversations_main")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", conversation_id);
  ```
  (Wrap in try/catch, non-fatal, matching existing pattern.)
- Also do the same when the assistant's reply intent is classified as `closed` later in the flow (around line 621–624) — if `intent === "closed"`, update status to `"closed"`. This catches the "هل تحتاج مساعدة أخرى؟" → "لا" → closing greeting path.
- Skip the `closed_at` field if the column doesn't exist; status alone is what the dashboard reads. (I'll check the schema before deploying and only include columns that exist.)

No widget changes for #2 — the close intent already fires; only DB persistence is missing.

## Deliverables
- `/mnt/documents/widget-4.7.19-hostinger.js` (upload to Hostinger)
- Edge function `chat-ai` redeploy with the status update.

## Out of scope
- React widget (`widget/src/app/...`), dashboard UI, n8n workflow, rating flow.
