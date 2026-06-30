## Goal

When admin edits an OpenAI Key row (model, project_id, or per‑1M prices) — or replaces the OpenAI key itself — every usage record **from that moment forward** for every client must be calculated with the new values. Past `merchant_token_daily` rows must remain untouched (frozen at the price that was active that day).

Today the pricing fields on `admin_openai_keys` are mutable and `openai-usage-sync` reads "the current row" at sync time. If the admin edits prices, the next sync silently recomputes historical days with the new price (because `cost_usd` is overwritten on upsert). There is no concept of "effective from".

## What we'll change

### 1. Add price/model versioning (DB)

New table `admin_openai_key_versions`:
- `id`, `key_id` (FK → `admin_openai_keys.id`), `slot`, `project_id`, `default_model`, `input_price_per_1m`, `output_price_per_1m`, `tokens_per_word`, `effective_from timestamptz`, `effective_to timestamptz NULL`, `created_by`, `created_at`.
- Trigger on `admin_openai_keys` (AFTER INSERT/UPDATE of the priced columns): close the current open version (`effective_to = now()`) and insert a new row with `effective_from = now()`. Same trigger fires when `project_id` or `default_model` changes — that's the "I rotated the key / switched model in n8n" cutover.
- Backfill: one initial version per existing key with `effective_from = now() - interval '30 days'` so old rows still resolve.
- Standard grants + RLS (admins read; service_role full; no anon).

### 2. Make the sync function version‑aware

`supabase/functions/openai-usage-sync/index.ts`:
- Load **all** versions (not just current rows) into a per‑`project_id` timeline.
- For each daily usage bucket, pick the version whose `[effective_from, effective_to)` covers that bucket's day. If a day straddles a cutover, attribute the whole day to the version active at the *end* of that day (Usage API returns daily buckets — fine‑grained enough for monthly billing).
- Compute `cost_usd` and `words_approx` with that version's price + `tokens_per_word`.
- Already‑written rows for past days are not re‑touched: change upsert to **insert‑if‑missing** for `merchant_token_daily` (and `admin_openai_unattributed_daily`) on days strictly before today (Riyadh tz). Today's row is still upserted so partial‑day data keeps refreshing under the currently‑active version.
- After a save the admin can also trigger a one‑off "advance watermark to now" via the existing flow (no recompute of history).

### 3. UI cutover signal (OpenAIKeysCard)

`src/app/components/admin/OpenAIKeysCard.tsx`:
- On save, after the `update`, call the edge function `openai-usage-sync` once (fire‑and‑forget) so a fresh sync immediately starts using the new version.
- Show a small "active since {timestamp}" line under each row using the latest version's `effective_from`.
- Confirmation modal before saving: "All new conversations from now on will be billed at the new model/price. Past data stays as is." (AR + EN).

### 4. Customer panel (MerchantConsumptionTable)

No schema change — rows already carry `model` + frozen `cost_usd`. Add a tiny tooltip in the header explaining that historical rows reflect the price active that day, future rows reflect the latest active version.

## Out of scope

- No recompute of historical `cost_usd` (intentional — that's the user's requirement).
- No changes to `chat-ai` / `classify-conversation` (they only set the `user` attribution; pricing lives in sync).
- IQ‑Test still inherits Key #1's currently‑active version (same as today).

## Files touched

- new migration: `admin_openai_key_versions` + trigger + backfill + grants/RLS
- `supabase/functions/openai-usage-sync/index.ts` — version timeline + don't‑overwrite‑past logic
- `src/app/components/admin/OpenAIKeysCard.tsx` — confirm modal, post‑save sync ping, "active since" label
- `src/app/components/admin/MerchantConsumptionTable.tsx` — header tooltip only
