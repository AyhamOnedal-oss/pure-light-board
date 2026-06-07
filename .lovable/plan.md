## AI-assigned ticket priority + priority sort

Currently every ticket from the widget is saved with `priority='medium'` and the list is sorted purely by `created_at`. Add AI urgency-based priority and sort the list by priority.

### Changes

1. **`supabase/functions/classify-conversation/index.ts`**
   - Extend the system prompt to also output `priority: "high" | "medium" | "low"` based on customer urgency + sentiment:
     - **high** — angry tone, escalation language, damaged/lost order, payment problem, repeated complaints, explicit refund/cancellation demands, threats to leave.
     - **medium** — clear request or complaint without strong urgency cues.
     - **low** — inquiries, suggestions, casual questions, greetings only.
   - Validate the value against `['low','medium','high']`, default to `medium`.
   - After updating `conversations_main`, also update the linked ticket(s):
     `update tickets_main set priority = <priority> where conversation_id = <id> and tenant_id = <id>`.

2. **`src/app/components/TicketsPage.tsx`**
   - In `loadTickets`, after mapping rows, sort by:
     1. `status` — open first, closed last
     2. `priority` — high (3) → medium (2) → low (1)
     3. `createdAt` desc as final tie-breaker
   - Remove reliance on DB `order by created_at` alone (keep the query for initial fetch, but resort in JS).

3. **Backfill** — none needed. Existing tickets keep their current `medium` priority; new conversations get AI-assigned priority going forward. Re-analyze button (already in the UI) will refresh priority for old tickets on demand.

### Technical notes
- The OpenAI JSON schema gains one field; cost impact is negligible.
- Ticket priority is updated by service-role from the edge function, so it works even though the conversation owner isn't authenticated.
- `priority` enum on `tickets_main` already includes `low|medium|high|urgent`. We map `urgent → high` in the UI (existing behavior), so no migration.