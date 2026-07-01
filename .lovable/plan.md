
## 1. New KPI card: "Number of Conversations" (`عدد المحادثات`)

**Backend (`admin_kpis` RPC — migration):**
- Add `total_conversations` + `prev_total_conversations` to the returned JSON.
- Count from `public.conversations_main` where `is_test = false`, across all tenants, filtered by `created_at` within `_from`/`_to` (same range logic as other KPIs). Previous-period count reuses the existing `v_pfrom`/`v_pto` window.

**Frontend (`AdminDashboard.tsx` + `services/adminDashboard.ts`):**
- Extend the `AdminKpis` interface with the two new fields.
- Add a new card (icon: `MessageSquare` from lucide) between "Active Customers" and "Total Bubble Clicks", wired to `liveKpis.total_conversations` with the same `pct()` trend logic. Colour: `#0EA5E9`.

## 2. OpenAI Keys card — rename "Notes" column to "Cost"

**Column header:** `Notes / ملاحظات` → `Cost (USD) / التكلفة (دولار)`.

**Value shown per row:** cumulative USD spent on that slot, summed from `public.merchant_token_daily.cost_usd` joined to `admin_openai_keys.project_id`. Row #3 (IQ Test) sums rows where `scope = 'iqtest'` (or falls back to Chat's project — I'll confirm by reading `merchant_token_daily` shape when implementing; existing `admin_tokens_global_monthly` already links `project_id → slot`).

**Backend:** small new RPC `admin_openai_cost_by_slot()` returning `{slot, cost_usd}` for `chat`, `classifier`, `iqtest`. Frontend fetches it alongside the keys and displays `$X.XX` per row (or `—` if 0). The edit dialog keeps the `notes` textarea (still stored in DB) but is relabelled so it no longer implies free-text notes — I'll drop the field from the edit modal entirely since the column is now derived, and hide the DB `notes` column from the UI.

## 3. Edit-button icons

- Rows #1 (chat) and #2 (classifier): replace the `Plus` icon shown when `empty` with `Pencil` in every case (the button already handles both add and edit; only the icon changes).
- Row #3 (IQ Test): add a `Pencil` button that opens the same edit modal for the `chat` slot (since IQ Test reuses Chat's model/pricing per the existing note). Tooltip: "Edit (uses Chat key) / تعديل (يستخدم مفتاح الشات)".

## Technical notes

- Only two file edits (`AdminDashboard.tsx`, `OpenAIKeysCard.tsx`) plus one thin service update and two SQL migrations (extend `admin_kpis`, add `admin_openai_cost_by_slot`).
- No changes to date-filter logic — the new KPI card automatically inherits the top-right date range.
- Cost card value is cumulative (all-time) since spend accrues continuously; it is not tied to the top date filter, matching how the current card shows a static config.
