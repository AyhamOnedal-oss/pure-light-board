Three surgical edits to your existing `widget.js` (v3.5.0). I'll keep the file structure and ship a single in-place edit, no React rebuild.

## Fix 1 — Country flag renders as a colored block

Cause: `flagSVG()` returns a `<span>` whose child `<svg>` inherits whatever the host page's CSS does to `svg` / `span` (Hostinger templates often force `svg { width:100% }` or `span { display:inline }`, which collapses or stretches the flag and you see a colored box instead of the striped flag).

Fix: in `flagSVG()` set the wrap's inline style explicitly so host CSS can't override it, and force the `<svg>` to fixed dimensions + `display:block`:
```
wrap.style.cssText =
  'display:inline-block;width:'+size+'px;height:'+h+'px;'+
  'border-radius:3px;overflow:hidden;flex-shrink:0;line-height:0;background:transparent;';
// and on the svg element: style="display:block;width:100%;height:100%"
```

## Fix 2 — Ticket isn't created when user taps X → Create ticket

Two real bugs in `doSubmitTicket()` (line 1621) and `restCreateTicket()` (line 50):

1. `state.ticketCreated = true` is set BEFORE the REST call — if the POST fails, the widget thinks a ticket exists and shows the "already created" branch on retry. Move it into the success callback.
2. `restCreateTicket` swallows REST errors silently (`r.ok ? r.json() : null`). When RLS or a missing field makes Supabase return 401/400, the user sees a "success" screen with the random `#TKT-#####` placeholder and nothing in the dashboard. Replace with `r.json().then(rows=>...)` and on `!r.ok` log the body and show an inline error in the form.
3. `renderTicketCreatedScreen()` is called immediately, before the REST round-trip, so the badge always shows the local random ID (e.g. `#TKT-43820`) instead of the real `TKT-{n}`. Move the render call inside the success callback; show a small inline spinner on the button while the POST is in flight.

## Fix 3 — Version bump

Header line 3 → `Version: 3.6.0 (live ticket fix + flag inline-style fix)`

## Deliverable

I'll write the patched file to `/mnt/documents/widget.js` (v3.6.0) and surface it as a download artifact in the next message. Upload that single file to `widget.fuqah.net/widget.js` on Hostinger and hard-refresh.

## Notes / out of scope

- Database side is already fixed by yesterday's migration (`tickets_fill_defaults` trigger fills `display_code`, `category`, `customer_phone/name`, avatar color on insert).
- I will NOT add a manual ticket button — X-button → modal → "Create ticket" stays the only entry, per your earlier instruction.
- If after upload tickets still don't appear, the network tab will now show the exact 4xx error from `tickets_main` and we can fix RLS in one shot.
