# Show image caption in dashboard chat view

## What the user reported
When the customer sends an image **with text** in the widget (e.g. "هل متوفر عندكم المنتج؟" attached to a photo), the dashboard conversation view shows only the image — the caption text is missing.

## Root cause (not a widget / hostinger bug)
The widget actually sends the text correctly. There are two real bugs, both server/dashboard side:

1. **Dashboard renderer drops the caption.** In `src/app/components/ConversationsPage.tsx` (around line 540) and `src/app/components/TicketsPage.tsx` (around line 717), when `msg.type === 'image' | 'file'` the bubble renders ONLY `<AttachmentBubble />` and never renders `msg.text`. So any caption is invisible by design.
2. **Edge function persists the wrong body for image messages.** In `supabase/functions/chat-ai/index.ts`, the `isProduct && hasStrongIdentity` / weak-signal / fallback branches call `persistMessages(userText, reply)`. `userText` has been mutated to include the vision JSON block / search instructions for n8n. That noise then becomes the message `body` stored in `conversations_messages`, so even if the dashboard rendered the caption, it would show the vision payload, not what the customer typed.

So the hostinger widget file does not need any edit — the widget already includes the text in the payload and the customer bubble in the widget shows it. The fix is on the dashboard + edge function side.

## Changes

### 1. `supabase/functions/chat-ai/index.ts`
- In `persistMessages`, always persist the **original customer message** as the user `body`, not the vision-augmented `userText`. Concretely: replace each `persistMessages(userText, reply)` call with `persistMessages(message, reply)` (the existing variable that already holds the raw customer text, or the auto-placeholder when the customer sent no text). Keep `userText` purely for the n8n payload (`message: userText` stays unchanged).
- Leave attachment persistence as-is (`attachments: attachmentsIn`) so the dashboard still knows it's an image message.

### 2. `src/app/components/ConversationsPage.tsx` (image/file bubble around line 540)
Render the attachment **and** the caption when both exist:
```text
<AttachmentBubble ... />
{msg.text && msg.text.trim() && (
  <div className="px-4 pt-2"><LinkifiedText text={msg.text} onAi={msg.sender === 'ai'} /></div>
)}
```
Keep the existing time row underneath.

### 3. `src/app/components/TicketsPage.tsx` (image/file bubble around line 717)
Same change as ConversationsPage so ticket detail view also shows captions under attachments.

### 4. `src/app/components/ChatLogDownload.tsx`
Already renders `[Attachment: <fileName>]` next to message text, so no change needed — it will start including the caption automatically once the edge function stores the raw customer text.

## Out of scope
- `public/widget-*.js` hostinger bundle (no change required — widget already sends text + attachment correctly and renders both locally).
- `TestChat.tsx`, classifier prompts, vision prompt, n8n workflow JSON, billing, `classify-conversation`.
- The widget source under `widget/src/app/components/ChatMessage.tsx` (it already renders text + attachment together).
