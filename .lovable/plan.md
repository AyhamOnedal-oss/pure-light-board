## Goal
Move the admin panel completely off the "words" model and onto **conversations + tokens + cost**, plus snapshot each subscription cycle into a real "Previous Subscriptions" history so numbers reset per period without losing history.

## 1. Terminology sweep (admin panel only)

Replace every user-visible reference to Words with the new labels, everywhere in `src/app/components/admin/*` and admin pages:

| Old label | New label |
|---|---|
| Words / الكلمات (as a metric) | Number of Conversations / عدد المحادثات |
| Input Words / كلمات المدخلات | Input Tokens / التوكنز المدخلة |
| Output Words / كلمات المخرجات | Output Tokens / التوكنز المخرجة |
| Used Words / الكلمات المستخدمة | Total Cost / التكلفة الإجمالية (USD) |
| Add Words / إضافة كلمات | (kept as internal admin credit action, relabeled "Top-up / إضافة رصيد") |
| "Words / Tokens Usage" dashboard chart | "Conversations & Tokens" |
| "Word usage alert - 80%" activity event copy | "Usage alert - 80%" |
| Customers table "Words" column | "Conversations" |

Files touched:
- `AdminCustomerDetails.tsx` — subscription card fields, Add-Words modal, activity translations, state names.
- `MerchantConsumptionTable.tsx` — IQ Test row: hide the Conversations cell (render "—") since it's not a conversation.
- `AdminCustomers.tsx` — column header + cell.
- `AdminDashboard.tsx` — chart title, legend, tooltip.

No copy changes in the merchant-facing app.

## 2. Current Subscription card (Customer Info → Subscriptions)

Rewrite the left column of the Current Subscription card to show, sourced from `merchant_token_daily` (scope `chat`/`vision`) + `conversations_main` for the current period (from `settings_plans.period_start`):

- Plan
- Start Date / End Date
- **Number of Conversations** — count(`conversations_main` where `is_test=false`)
- **Input Tokens** — sum(`input_tokens`)
- **Output Tokens** — sum(`output_tokens`)
- **Total Cost Consumed (USD)** — sum(`cost_usd`)

The right-side donut becomes a cost-vs-plan-budget donut (or a simple 4-tile stat block if no budget is set).

## 3. Subscription period snapshots

New table `public.admin_subscription_periods`:

- `tenant_id`, `plan`, `period_start`, `period_end`
- `chat_conversations int`, `chat_input_tokens bigint`, `chat_output_tokens bigint`, `chat_cost_usd numeric`
- `analysis_conversations int`, `analysis_input_tokens bigint`, `analysis_output_tokens bigint`, `analysis_cost_usd numeric`
- `iqtest_input_tokens bigint`, `iqtest_output_tokens bigint`, `iqtest_cost_usd numeric`
- `closed_at timestamptz`, standard timestamps

+ GRANTs, RLS: only `super_admin` / admins with `admin_dashboard` can read; edge function writes via service role.

New RPC `public.admin_snapshot_subscription(_tenant uuid)` that aggregates the current period (`period_start` → now) from `merchant_token_daily` + `conversations_main` and inserts one row.

## 4. Snapshot on end / renew

Update `supabase/functions/admin-subscription-actions/index.ts`:

- `end` action → call `admin_snapshot_subscription(tenantId)` before flipping status.
- `renew_trial` action → snapshot first, then reset `period_start` / usage (as today).
- New `renew_paid` action (used when a paid subscription rolls over) does the same: snapshot then reset. Wire an internal call from the existing plan-renewal code path if present; otherwise expose it as an admin button next to Add Words.

## 5. Previous Subscriptions card

Replace the placeholder loop with a list backed by `admin_subscription_periods`, ordered `closed_at desc`. Each row shows: plan, `period_start → period_end`, Conversations, Input Tokens, Output Tokens, Cost, plus a compact IQ-Test / Analysis breakdown underneath.

## 6. IQ Test rule

Everywhere IQ Test surfaces (Merchant Consumption table, snapshots, Previous Subscriptions detail), render only **Input Tokens / Output Tokens / Cost** — no conversation count.

## Technical notes
- No merchant-app copy changes (`DashboardPage.tsx`, `PlansPage.tsx` remain on "المحادثات" as already shipped).
- Snapshot RPC uses the same period-split logic already in `MerchantConsumptionTable.tsx` so numbers stay consistent.
- Activity log copy for `usage_80` stays as an alert but drops the word "Words".
- No changes to `openai-usage-sync` or pricing versioning.
