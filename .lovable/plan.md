# Simplify: chat via webhook, everything else via Supabase REST

## New architecture

```
Storefront widget
   │
   ├──► chat-ai (edge fn) ──► n8n webhook ──► AI reply
   │       └─ persists customer + AI messages to conversations_messages
   │
   ├──► Supabase REST (anon key) ──► tickets_main           [insert ticket]
   ├──► Supabase REST (anon key) ──► conversations_main     [update rating]
   └──► Supabase REST (anon key) ──► conversations_messages [load history]

Dashboard: reads everything from the same tables (already works).
```

No new edge functions. No "tickets-create" function. The widget POSTs directly to PostgREST using the public anon key, gated by RLS policies.

## What needs to change

### 1. Add anon-friendly RLS policies

Today every write to `tickets_main`, `conversations_main`, `conversations_customers`, and `conversations_messages` requires `tenant_role_at_least(..., 'agent')` — meaning a logged-in dashboard user. Anonymous storefront visitors cannot insert.

Add narrow public policies (anon role) so the widget can:

- **`tickets_main`** — `INSERT` allowed for anon when `tenant_id` exists in `settings_workspace` and `status='open'` (no privilege escalation, no assignee, no SLA tampering). Only fields the widget controls: `tenant_id`, `conversation_id`, `subject`, `description`, `category`, `customer_name`, `customer_phone`, `customer_id`. Reads stay locked.
- **`conversations_main`** — `UPDATE` allowed for anon **only** to set `csat_rating`, `rating_comment`, `status='closed'`, `close_reason` for an existing conversation that belongs to the same tenant. No other columns mutable.
- **`conversations_messages`** — `SELECT` allowed for anon when filtered by `conversation_id` that belongs to a known tenant (so widget can reload history). Inserts stay restricted (those still happen server-side via `chat-ai`).
- **`conversations_customers`** — `SELECT` allowed for anon by `external_id` so the widget can find an existing customer/conversation on reopen.

All policies scoped to specific columns / specific values to avoid leaks.

### 2. Widget calls (no code today, planned for next build)

```js
// Create ticket — direct REST
fetch(`${SUPABASE_URL}/rest/v1/tickets_main`, {
  method: 'POST',
  headers: { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ tenant_id, conversation_id, subject, customer_name, customer_phone, status: 'open' })
})

// Submit rating — direct REST
fetch(`${SUPABASE_URL}/rest/v1/conversations_main?id=eq.${conversation_id}`, {
  method: 'PATCH',
  headers: { ...auth },
  body: JSON.stringify({ csat_rating, rating_comment, status: 'closed', close_reason: 'customer_manual' })
})

// Load past messages on reopen — direct REST
fetch(`${SUPABASE_URL}/rest/v1/conversations_messages?conversation_id=eq.${id}&order=created_at.asc`)
```

Chat itself keeps going through `chat-ai` → n8n.

### 3. chat-ai unchanged
Still the only place that:
- resolves tenant
- rate-limits
- talks to n8n
- inserts into `conversations_messages` (customer + AI reply)

### 4. Dashboard unchanged
Tickets page already queries `tickets_main`. The moment the widget inserts a row, it appears.

## What I'll do next (after you approve)

1. Run the migration above (4 RLS policies, no schema changes).
2. Update `widget.js` to:
   - Call REST for ticket creation from the inline ticket form / "End conversation → Create ticket" flow
   - Call REST to PATCH rating on rating screen submit
   - Call REST to GET prior messages on widget open (using stored `conversation_id` from localStorage)
   - Bump version to `v3.4.0`
3. Re-export `widget.js` to `/mnt/documents/` for upload to Hostinger.

## Out of scope
- No new edge functions.
- No realtime (polling/refresh stays manual in dashboard for now).
- No file attachments from the widget (text-only tickets/messages).
