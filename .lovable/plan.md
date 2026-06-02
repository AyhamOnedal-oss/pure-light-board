## Goal
Fix two end-of-chat flows in the Hostinger widget (v4.7.20) and keep DB status in sync.

## 1. Idle prompt → "End chat" must go through rating
Current: `InactivityPrompt` "إنهاء المحادثة" closes immediately (or auto-skips rating).
Change:
- When user taps **إنهاء المحادثة** in the idle banner → route to `renderRatingScreen()` (same as a normal end), NOT a direct close.
- Rating screen behavior stays as-is: submit / skip / 15-min auto-close all → full session reset.
- "متابعة المحادثة" stays unchanged (clears idle timers, keeps conversation).

## 2. Ticket created → "حسناً شكراً لك" must end immediately (no rating)
Current: tapping the primary button on `TicketCreatedScreen` advances to the rating screen.
Change:
- Primary CTA **حسناً شكراً لك** → immediately end + full session reset (no rating screen).
- Back arrow (top-right) still lets user return to chat and keep talking — unchanged.
- "تحميل التذكرة" stays unchanged.
- Remove the auto-advance `setTimeout` that pushes to rating after 3.5s.

## 3. Full session reset (shared helper, already planned for v4.7.20)
On any terminal exit (rating submit, rating skip, rating auto-close, idle→rating→end, ticket "شكراً لك"):
- `notifyBackendClose(reason)` → marks `conversations_main.status='closed'` with appropriate `close_reason`:
  - `user_end_inactivity` (idle banner end → rating done/skip/auto)
  - `user_rating_submitted` / `user_rating_skipped` / `rating_auto_close`
  - `user_ticket_acknowledged` (new — for the شكراً لك path)
- Clear `state.messages`, generate new `state.conversationId`, reset all flags.
- Next widget open = brand-new conversation.

## 4. Files touched
- `widget-4.7.20-hostinger.js` (built artifact in `/mnt/documents/`)
  - Idle banner end-button handler → call `openRatingScreen()` instead of `closeAndReset()`
  - Ticket-created primary button → call `closeAndReset('user_ticket_acknowledged')` instead of opening rating
  - Remove ticket-screen auto-advance timer
- `supabase/functions/conversation-close/index.ts` (new, from prior plan) — accepts `{conversation_id, reason}` and updates `conversations_main`.
- No React widget / dashboard changes.

## Out of scope
- AI auto-detect close path (already working, untouched).
- Rating UI redesign.
- n8n workflow.

## Confirm before I build
- Idle "End chat" → rating screen → then reset. ✅ (matches your message)
- Ticket "شكراً لك" → immediate reset, no rating. ✅
- Back arrow on ticket screen → returns to chat (unchanged). ✅