## What's broken

I traced all four issues end-to-end. Here's the actual state of the system:

### 1. "Show chat bubble" toggle is ignored by the storefront
- `bubble_visible` is saved on `settings_train_ai` (TrainAI page).
- The storefront fetches config from `widget-config`, which only returns `settings_chat_design` — so `bubble_visible` is **never sent to the widget**.
- The Hostinger `widget.js` you upload also has no `if (cfg.bubble_visible === false) return;` guard.
- Result: toggle off has zero effect.

### 2. "Push prompt / file from dashboard to widget via n8n"
Good news: this **already happens on every message**. `chat-ai` loads `settings_train_ai.{mode, prompt, file_url}` and forwards it to your n8n webhook as:
```json
{ "ai": { "mode": "prompt", "prompt": "...", "file_url": "..." }, "store": {...}, "history": [...] }
```
What's missing is a clear contract for n8n + a way for the AI Agent node in your screenshot to actually consume it. Today your AI Agent node has no system message bound to `{{$json.ai.prompt}}`, so the prompt arrives but is discarded by n8n. Same for `file_url`.

### 3. Widget clicks not counted
- `widget-events` correctly increments `dashboard_usage_daily.clicks` on `event: "bubble.click"`.
- The published Hostinger `widget.js` (v3.7.1, hand-patched) is missing the `postEvent('bubble.click', tenantId)` call inside the bubble open handler — it was lost during the flag-shift patch.

### 4. Word count not working
- `chat-ai` writes per-message `word_count` into `conversations_messages` ✓.
- But the quota meter on PlansPage reads `settings_plans.monthly_words_used`, which **nothing ever increments**. So it stays at 0 forever.

---

## Fix plan

### A. Bubble visibility — make it work end-to-end
1. Include `bubble_visible` in the `widget-config` response by joining `settings_train_ai`:
   ```ts
   const [{ data: design }, { data: workspace }, { data: train }] = await Promise.all([
     supabase.from("settings_chat_design")...,
     supabase.from("settings_workspace")...,
     supabase.from("settings_train_ai").select("bubble_visible").eq("tenant_id", tenantId).maybeSingle(),
   ]);
   return jsonResponse({ ...design, bubble_visible: train?.bubble_visible ?? true, ... });
   ```
2. Update the `widget-loader` Edge Function (the canonical loader) so `mount()` early-returns when `cfg.bubble_visible === false`:
   ```js
   if (cfg && cfg.bubble_visible === false) { return; }
   ```
3. Apply the **same one-line guard** to the Hostinger `widget.js` (v3.7.2) and produce a new file for you to upload. No other Hostinger changes.
4. Verification: toggle off in dashboard → reload store within 60s (widget-config has 60s cache) → bubble gone. Toggle on → bubble back.

### B. Prompt / file push to widget via n8n — formalize the contract
The push already happens. We'll do two things:

1. **Document the n8n binding** (the actual fix). In your n8n flow:
   - Webhook node receives the body from `chat-ai`.
   - AI Agent node → "System Message" = `={{ $json.ai.prompt }}`
   - AI Agent node → "User Message" = `={{ $json.message }}`
   - HTTP Request node (if you want the file content) = `GET {{ $json.ai.file_url }}` then pass result back into the AI Agent as a tool / context.
   - Respond to Webhook → body `={{ { reply: $json.output } }}`
   I'll add this as `docs/n8n-integration.md` so you have the exact mappings.

2. **Add a `widget-context` Edge Function** (clean pull endpoint) so an n8n HTTP Request node can fetch the current prompt/file/store on demand without depending on `chat-ai`'s payload shape:
   ```
   GET /functions/v1/widget-context?tenant_id=...
   → { prompt, file_url, mode, store: { name, locale, domain, platform } }
   ```
   This is the "clear way to push from dashboard". Whenever the merchant saves a new prompt in the dashboard, the very next chat call sees it (no caching). For the file, n8n calls `widget-context` then `GET file_url`.

3. (Light extra) Send file URL only when `mode === 'file'` and prompt only when `mode === 'prompt'`, so n8n doesn't have to guess.

### C. Widget click counting — re-attach the event in Hostinger widget.js
1. Re-add inside the bubble click handler:
   ```js
   bubble.addEventListener('click', function () {
     open = !open;
     panel.style.display = open ? 'flex' : 'none';
     if (open) { try { fetch(SUPABASE_URL + '/functions/v1/widget-events', { method: 'POST', headers: {...}, body: JSON.stringify({ event: 'bubble.click', tenant_id: TENANT_ID }), keepalive: true }); } catch(e) {} }
   });
   ```
2. Verify by clicking bubble on the live store, then running `select clicks from dashboard_usage_daily where tenant_id=... and day=current_date;` — it should increment.
3. Bump widget to v3.7.2 with both fixes (A.3 + C.1) and deliver `widget.js` + `widget-v3.7.2.js` + notes.

### D. Word count — actually increment the quota meter
1. Add a Postgres trigger on `conversations_messages` (AFTER INSERT) that bumps:
   - `settings_plans.monthly_words_used` (for the PlansPage meter)
   - `dashboard_usage_daily.ai_words_used` (for daily charts), only when `sender = 'ai'`
   - `dashboard_usage_daily.customer_words_used` if such column exists, when `sender = 'customer'`
   
   Using a trigger (not chat-ai code) means even messages persisted from other paths still count.
2. Reset logic: if `settings_plans.period_start` is older than 1 month, reset `monthly_words_used` to 0 before incrementing.
3. Verification: send one message via the widget → refresh PlansPage → `usedWords` jumps by the message word count + the AI reply word count.

---

## Files I'll change

- `supabase/functions/widget-config/index.ts` — add `bubble_visible` to response.
- `supabase/functions/widget-loader/index.ts` — guard mount on `bubble_visible`.
- `supabase/functions/widget-context/index.ts` — **new** clean endpoint for n8n.
- `supabase/functions/chat-ai/index.ts` — only send `file_url` when `mode === 'file'`, etc.
- New Postgres migration — trigger on `conversations_messages` to bump word usage.
- Hostinger widget (delivered): `widget.js` v3.7.2 with bubble_visible guard + click event.
- `docs/n8n-integration.md` — exact n8n node bindings for prompt/file.

## What I won't touch
- Auth, RLS, tickets, the existing chat-ai → n8n round-trip semantics, the visual widget design.

## Verification checklist (before I say it's done)
- [ ] Toggle bubble off → bubble disappears in store after reload.
- [ ] Click bubble 3× → `dashboard_usage_daily.clicks` for today increases by 3.
- [ ] Send a 10-word message + receive a 25-word reply → PlansPage "words used" increases by 35.
- [ ] n8n HTTP Request node hitting `/widget-context?tenant_id=…` returns the latest prompt the merchant typed.