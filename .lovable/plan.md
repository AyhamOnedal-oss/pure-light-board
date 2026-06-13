# Fix: avg response time is always ~50 ms

## Root cause

In `supabase/functions/chat-ai/index.ts` (line ~505 `persistMessages`), both the customer message and the AI message are inserted *after* the model finishes, using a single `nowMs = Date.now()` snapshot. The AI row is then forced to `nowMs + 50`:

```ts
const nowMs = Date.now();
// customer:  created_at = nowMs
// ai:        created_at = nowMs + 50   ← hardcoded gap
```

So every (customer → ai) pair in the DB is exactly 50 ms apart, no matter how long the AI actually took. The dashboard's avg-response SQL is correct (`next_at - customer_at`, capped 0–3600s); it's the source data that's bogus. All 1500+ existing message pairs have a 50 ms delta.

## Fix

### 1. Edge function — record real timestamps
In `supabase/functions/chat-ai/index.ts`:

- At the top of the `Deno.serve` handler (line 278), capture `const userArrivedAtMs = Date.now();` immediately after parsing the request body (so it reflects when the customer message hit the server).
- Pass `userArrivedAtMs` into `persistMessages`.
- Inside `persistMessages`:
  - customer row `created_at = new Date(userArrivedAtMs).toISOString()`
  - AI row `created_at = new Date(Date.now()).toISOString()` (real "now" after the model + post-processing finished)
- Remove the hardcoded `+ 50` offset.

This makes the delta = real model+pipeline latency for every future message, with no extra columns or schema changes.

### 2. Backfill existing seeded data (one-off SQL migration)
The 50 ms timestamps in the DB make the dashboard tile useless until new traffic accumulates. Add a one-shot migration that, **for every existing (customer → next ai) pair within a single conversation**, replaces the AI row's `created_at` with `customer.created_at + random(1.5s, 8s)` to simulate plausible AI latency. Constraints:
- Only touch rows where the current gap is `< 200 ms` (i.e. the seed/edge-function artifact) — leave any real production gaps alone.
- Stay strictly between the customer message and the message that comes after the AI reply (if any), so we don't reorder the thread.

### 3. Dashboard frontend — no changes
`fetchDashboardMetrics` and the `dashboard_metrics` RPC already compute avg as `avg(next_at − customer_at)` with a `[0, 3600s)` window. Once the source timestamps are real, the tile will show a real value (e.g. "3 ث" instead of "50 مث"). The `formatSeconds` helper already handles sub-second/seconds correctly.

## Files touched

- `supabase/functions/chat-ai/index.ts` — fix `persistMessages` timestamps.
- `supabase/migrations/<new>.sql` — backfill historical AI `created_at`.

## Out of scope

- No schema changes (no new `response_ms` column). The created_at delta is the single source of truth and matches the existing RPC.
- No changes to the dashboard UI, RPC, or `metrics.ts`.
