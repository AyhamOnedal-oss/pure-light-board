## Problem

Edge function logs confirm n8n always returns `next_action: "none"`. The widget was rewritten to react ONLY to `action.type`, so:
- Phone box never appears (no `offer_ticket` ever fires)
- Auto-rating after close never fires (no `offer_close` ever fires)
- Workflow is broken end-to-end

## Fix — simplify, drop the action envelope dependency

### 1. Widget (`ChatWindow.tsx`)
- Bring back **text-based heuristic** detection on the AI reply (Arabic + English) so the widget works regardless of what n8n returns:
  - If AI reply mentions "خدمة العملاء"/"تذكرة"/"يتواصل معك"/"customer service contact" → render the inline **phone input box** right after the reply.
  - Also keep the existing affirmative guard (user says "نعم" after such an offer) as a fallback.
- Remove the `offer_close` auto-rating path entirely (it never fires and confuses things). Rating only appears via the ticket flow (Flow B) or the manual X → confirm modal.

### 2. After phone submission (Flow B — the only handoff path)
- On successful `postTicket`:
  1. Mark the inline form as submitted (locks the input).
  2. Inject a bot bubble in chat: **"تم استلام رقمك ✅ سيتواصل معك أحد موظفي خدمة العملاء في أقرب وقت. شكراً لك 🌷"**
  3. After **5 seconds**, auto-transition to `RatingScreen` so the user can rate the AI.
- Remove the separate `TicketCreatedScreen` jump (no more full-screen takeover). Keeps the conversation visible until rating.

### 3. Edge function (`chat-ai`)
- Leave the tolerant parser + friendly fallback as-is (good).
- No more reliance on `action.type` from the widget side, but keep passing it through for future use.

### 4. Deliver the build
- Rebuild widget bundle → produce **`widget-4.7.12-hostinger.js`** in `/mnt/documents/` ready for Hostinger upload.

## Result

| User action | What happens |
|---|---|
| Asks normal question | AI replies, nothing extra |
| AI offers customer service handoff (any phrasing) | Phone box appears inline |
| User submits phone | Ticket created → bot confirmation message → after 5s rating screen |
| User clicks X | Existing confirm modal → rating (unchanged) |

No more dependence on n8n returning structured actions. Workflow becomes robust to whatever n8n emits.
