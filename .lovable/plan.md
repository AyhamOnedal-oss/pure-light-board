# Fix Plan (after reviewing widget.js v3.4.0)

## Root causes I confirmed in the deployed `widget.js`

1. **Old conversation comes back after refresh** — confirmed bug.
   On every page load, lines 2082–2098 read `fuqah_conversation_id` from `localStorage` and call `restLoadHistory` to refetch up to 50 messages. There is no check whether that conversation is closed/rated/ticketed, so any ended conversation reappears. The id is saved (line 2041) the moment `chat-ai` returns a UUID, and is never cleared.

2. **Ticket-form design bug** — confirmed (line 1591).
   `body.appendChild(el('div')).style.cssText = 'flex:1;min-height:24px;'` is a flex spacer that pushes the submit button to the very bottom, leaving the empty area you see between the phone input and the button. Also: the SA flag in your screenshot renders as a solid green box because the country selector falls back to a colored rectangle when the SVG flag fails to load.

3. **Ticket saved without details** — confirmed.
   Direct REST insert (line 48 `restCreateTicket`) bypasses the `widget-events` edge function, so:
   - `customer_name` stays null (form only collects phone).
   - `display_code` is not generated (the column is not set; only computed from `number` client-side).
   - `category` is null because the conversation hasn't been re-classified yet at insert time.
   - `conversations_main.ticket_status` is not set to `'open'` after the insert, so the dashboard tag "Open Ticket" doesn't light up.

4. **Stale placeholder conv id used for ticket** — partial bug.
   `restCreateTicket` uses `state.conversationId`. If the user opens the chat, types a message, and the AI hasn't replied yet (so the swap on line 2040 hasn't happened), the ticket would be inserted with the local `conv_…` placeholder, which doesn't exist in `conversations_main` and breaks linkage. Need a guard.

## Fixes

### A. Stop restoring old conversations on refresh
Edit `widget.js` v3.4.0 (and the source file `widget/src/app/components/FloatingWidget.tsx`):

- Delete the restore block at lines 2082–2098. New behavior: every page load starts a brand-new chat with a fresh local `conv_…` id. The backend UUID is assigned the moment the user sends the first message.
- Stop calling `persistConversationId(...)` on line 2041. Don't write `fuqah_conversation_id` at all.
- Keep only `fuqah_visitor_id` in localStorage (so analytics still recognize the same visitor).
- In `fullClose()` (line 1770) also call `localStorage.removeItem('fuqah_conversation_id')` once, to clean up any old keys still saved from previous installs.

Result: refresh = empty new chat. Ended conversations live only in the dashboard.

### B. Fix the ticket-form layout
- Remove the `flex:1; min-height:24px` spacer (line 1591). The button should sit naturally below the phone input with `margin-top: 16px` (or move the submit into a sticky footer with proper padding).
- Replace the country-flag block fallback with the same flag SVG used in the inline form (`CountryFlag` in source).
- Tighten the screen: title at top, single phone input, helper text, submit button, and "powered by" footer — no empty middle gap.

I'll mirror the same fix in source `widget/src/app/components/CreateTicketForm.tsx`, then rebuild.

### C. Make ticket creation reliable + complete
In `restCreateTicket`:
- Guard: if `state.conversationId` starts with `conv_` (not a UUID), call `chat-ai` first with the user's message, await the swap, then insert the ticket using the real UUID.
- After successful insert, also `PATCH conversations_main` setting `status='closed'`, `close_reason='customer_manual'`, `ticket_status='open'`, `resolved_at=now()`. This both lights up the "Open Ticket" badge in the dashboard AND fires the classify trigger so AI fills in `category`/`completion_score`.
- Save `customer_name` if collected (or fall back to phone). Generate `display_code = 'TKT-' + row.number` and PATCH it back into the row so the dashboard shows it.

### D. Two ways to raise a ticket
- Manual: add a small "إنشاء تذكرة دعم" button in `ChatHeader` (next to the X) that opens the ticket-form screen directly.
- AI-driven: when `chat-ai` returns `escalate: true` (forwarded from n8n), inject a system message and an inline ticket form. Small change in `supabase/functions/chat-ai/index.ts` to pass the flag through to the widget.
- Remove the `'A'` test trigger from source.

### E. Dashboard polish
- `TicketsPage.tsx`: render `display_code` (e.g. `TKT-328`) instead of `#id.slice(0,8)` when it's set.
- Re-analyze button is already wired for unclassified conversations.

## Files to change

- `widget/src/app/components/FloatingWidget.tsx` — stop persisting/restoring conversation
- `widget/src/app/components/ChatWindow.tsx` — explicit ticket button entry, remove `'A'` trigger, escalation handling
- `widget/src/app/components/ChatHeader.tsx` — add manual ticket button
- `widget/src/app/components/CreateTicketForm.tsx` — layout fix
- `widget/src/app/utils/chatApi.ts` — read `escalate` from response
- `supabase/functions/chat-ai/index.ts` — forward `escalate` flag from n8n
- `supabase/functions/widget-events/index.ts` — keep as fallback; no behavior change
- `src/app/components/TicketsPage.tsx` — show `display_code`
- Rebuild and redeploy `widget.js` to `widget.fuqah.net`

## Order of execution after approval
1. Fix conversation persistence (root cause of refresh bug) — single biggest UX win.
2. Fix ticket-form layout + flag.
3. Strengthen `restCreateTicket` (UUID guard, conversation close, display_code).
4. Add explicit ticket button + AI escalation.
5. Dashboard `display_code` rendering.
6. Build widget bundle and ask you to deploy.
