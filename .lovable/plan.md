## Root causes I found

1. **Ticket creation error `(401) ... violates row-level security policy for table tickets_main`**
   - The widget calls the `widget-events` edge function which uses the service-role key (bypasses RLS). So a clean install should never produce that exact message — unless the function is being called without `SUPABASE_SERVICE_ROLE_KEY` available (it falls back to `""`) or the deployed widget bundle on the storefront/CDN is an older build that hits Supabase REST (`/rest/v1/tickets_main`) directly with the anon key.
   - The current frontend (`postTicket`) goes through `/widget-events`, which is correct. But the function's failure response is opaque (`{ok:false, error:"ticket_insert_failed"}`) so we can't see the underlying cause in production logs.
   - `tickets_main` has `tickets_anon_insert_widget` policy, but anon was missing `INSERT, SELECT` GRANTS on the table earlier (added in migration `20260516003053`). That grant is needed even when RLS allows it, so as a defensive fallback it is now in place.

2. **Flag "shifted up and distorted"**
   - `CountryFlag` uses hand-drawn inline rectangles (Saudi flag is just a green box + a tiny white sword/rect). It is not a real flag.
   - The SVG sits inside `flex items-stretch` rows, which stretches the SVG element vertically because `<svg>` defaults to `display: inline` and the parent has `align-items: stretch`.

3. **Messages not chronologically ordered (`السلام عليكم` showing after the AI reply)**
   - `chat-ai` inserts the customer message and the AI reply in a single `insert([...])` array. Postgres assigns the **same `created_at`** (`now()` default) to both rows. The dashboard then orders by `created_at ASC` only, so ties are broken arbitrarily — the AI row sometimes wins.

## Plan

### 1. Ticket creation — make it bulletproof in both places

- **`widget-events` edge function**
  - Validate `SUPABASE_SERVICE_ROLE_KEY` at boot; return a clear `503 { error: "service_role_missing" }` if absent.
  - On the `ticket.created` branch, return the actual Postgres error message in the JSON body so we can debug from logs and from the widget. The widget currently shows the raw HTTP-level error string; the function will now match that envelope.
  - Make `customer_avatar_color` default in the function (already filled by trigger, but pass it through to be safe).
- **Widget `postTicket` (`widget/src/app/utils/analytics.ts`)**
  - Treat any non-2xx response as failure and surface `data.error || res.statusText` into a user-friendly Arabic message (no raw JSON dumped into the chat).
  - Retry once on network error before showing the error.
- **`ChatWindow` (`handleTicketFormSubmit`, `handleInlineTicketSubmit`)**
  - Show a localized message like "تعذّر إنشاء التذكرة. حاول مرة أخرى." (no raw 401 JSON).
  - On success, also persist the ticket id back into state and disable the form to prevent double submits.
- **RLS / grants safety net** (separate migration)
  - Tighten `tickets_anon_insert_widget`: also require `subject IS NOT NULL` and `customer_phone IS NOT NULL` so a misbehaving client can't insert junk rows.
  - Re-affirm `GRANT INSERT ON public.tickets_main TO anon` and `GRANT USAGE, SELECT ON SEQUENCE public.tickets_number_seq TO anon` (idempotent).
  - This keeps a working anon path even if the service-role function is temporarily down.

### 2. Country flags — use real flags

- Add the `country-flag-icons` package which ships real 4:3 SVGs (no network calls).
- Replace `widget/src/app/components/CountryFlag.tsx` to render the bundled SVG for the requested code, wrapped in a fixed-size `<span>` with `display: inline-flex; flex-shrink:0; overflow: hidden; border-radius: 3px` and an explicit `width` / `height` set via inline style so the parent `items-stretch` cannot deform it.
- Mirror change to any other place that renders a flag (search: `CountryFlag`).

### 3. Message ordering — guarantee customer-before-AI

- **`chat-ai`** (`supabase/functions/chat-ai/index.ts`): split the single `insert([customer, ai])` call into two sequential inserts, and write the AI row with `created_at: new Date(Date.now() + 50).toISOString()` so it is always at least 50 ms after the customer row, even if Postgres is fast.
- **Dashboard queries** (`TicketsPage.tsx`, `ConversationsPage.tsx`, `classify-conversation`): when ordering messages, add a deterministic tie-break — `ORDER BY created_at ASC, CASE sender WHEN 'customer' THEN 0 ELSE 1 END ASC, id ASC`. Implemented via `.order('created_at', { ascending: true }).order('sender', { ascending: true })` plus a client-side stable sort that puts `customer` before `ai`/`agent` when timestamps tie.

### 4. Wider audit follow-ups

- `ConversationsPage` uses the same message fetch — apply the same ordering fix.
- Realtime hook in `useDashboardMetrics` already listens to `conversations_messages` inserts; no change needed.
- Verify the welcome-bubble "Workspace name" placeholder (`aj1vxofkqc's Workspace`) — that comes from `settings_workspace.name` default in `handle_new_user`. Out of scope for this fix unless you want me to also wire the store name into widget config (currently it shows the workspace name).
- Confirm no other path inserts directly into `tickets_main` from anon code (`TestChat.tsx` is pure mock — verified).

## Technical details

- Files changed:
  - `widget/src/app/components/CountryFlag.tsx` (rewrite)
  - `widget/package.json` (add `country-flag-icons`)
  - `widget/src/app/utils/analytics.ts` (`postTicket` envelope + retry)
  - `widget/src/app/components/ChatWindow.tsx` (error wording, no raw JSON)
  - `supabase/functions/widget-events/index.ts` (return real error, env validation)
  - `supabase/functions/chat-ai/index.ts` (sequential inserts + 50 ms offset)
  - `src/app/components/TicketsPage.tsx` and `src/app/components/ConversationsPage.tsx` (stable sort with sender tie-break)
- New migration:
  - Tighten `tickets_anon_insert_widget` policy (`subject NOT NULL`, `customer_phone NOT NULL`).
  - Re-affirm `GRANT INSERT` on `tickets_main` and `USAGE, SELECT` on the number sequence to `anon`.

## What I will NOT touch unless you ask

- Widget welcome-bubble text content
- Theme/preview chat (`TestChat.tsx`) — it's pure local mock
- The classify-conversation prompt and model
- The realtime/dashboard refresh wiring
