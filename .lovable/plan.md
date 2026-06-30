
## Final decisions (locked)

- **2 OpenAI keys** total. Key 1 = chat + vision + Test Chat. Key 2 = post-closure analysis. No third key.
- **Vision uses direct OpenAI** (never Lovable Gateway).
- **Billing unit = conversations**. Plan quotas: Economy 250 / Basic 500 / Professional 750 / Business 1000 conversations/month. Editable in admin.
- **Test Chat**: Key 1, does NOT count as a billed conversation, daily cap **300,000 input / 3,000 output tokens**, resets **00:00 Asia/Riyadh**. Limit-hit Arabic message: "لقد وصلت إلى الحد اليومي لاختبار الذكاء. يمكنك المحاولة مجدداً غداً."
- **On renewal/plan change**: current period archived to `subscription_periods`, live counters reset.

## Per-merchant token attribution (the honest model)

| Source | Method | Accuracy |
|---|---|---|
| Vision in `chat-ai` | Direct log per call with `tenant_id` | Exact |
| Post-closure analysis (Key 2) | Direct log per call with `tenant_id` | Exact |
| Test Chat (Key 1) | Direct log per call with `tenant_id`, `is_test=true` | Exact |
| n8n AI Agent reasoning tokens | n8n returns `tokenUsageEstimate` → logged | Exact (what n8n exposes) |
| n8n tool-call tokens (Salla/Zid HTTP fetches) | Hourly OpenAI Usage API diff, pro-rata by daily chat turns | Reconciled; monthly accurate, daily ±few % per tenant |

Total per key always reconciles to your actual OpenAI bill within 1 hour.

## Database (single migration)

```sql
openai_keys(key_no PK, use_label, model, vision_model,
            input_price_per_1m, output_price_per_1m,
            openai_project_id, notes, updated_at, updated_by)

openai_call_log(id PK, created_at, tenant_id, key_no,
                source CHECK IN ('chat','vision','test_chat','analysis','goal_score','report'),
                model, input_tokens, output_tokens,
                conversation_id, is_test, request_id)

openai_usage_daily(day, key_no, model,
                   input_tokens, output_tokens, requests,
                   PRIMARY KEY (day, key_no, model))

merchant_token_daily(tenant_id, day, key_no, source, model,
                     input_tokens, output_tokens, conversations,
                     PRIMARY KEY (tenant_id, day, key_no, source, model))

plan_quotas(plan PK, monthly_conversations)

tenant_conversation_usage(tenant_id PK, period_start,
                          conversations_used, monthly_limit)

test_chat_quota(tenant_id PK, day,
                day_input_tokens, day_output_tokens,
                daily_input_cap default 300000,
                daily_output_cap default 3000,
                period_input_tokens, period_output_tokens)

subscription_periods(id PK, tenant_id, plan, started_at, ended_at,
                     conversations_used,
                     chat_input_tokens, chat_output_tokens, chat_cost_usd,
                     analysis_input_tokens, analysis_output_tokens, analysis_cost_usd,
                     test_chat_input_tokens, test_chat_output_tokens, test_chat_cost_usd,
                     reason)
```

GRANTs → RLS → policies for each. `openai_keys`, `openai_usage_daily`, `plan_quotas`: admin-only. `merchant_token_daily`, `tenant_conversation_usage`, `test_chat_quota`, `subscription_periods`: tenant-readable (own rows).

Seed:
- `openai_keys`: (1, "Chat + Vision + Test", "gpt-5.4-nano", "gpt-5.4-mini", 0.20, 1.25), (2, "Post-closure Analysis", "gpt-5.4-nano", null, 0.20, 1.25).
- `plan_quotas`: 250 / 500 / 750 / 1000.

SQL function `archive_and_reset_period(tenant_id, reason)` called on every plan change / renewal / expiry.

## Enforcement rules

- **Conversation count**: trigger on `conversations_main` → resolved/closed; if `is_test=false`, increment `tenant_conversation_usage`. Existing service-paused webhook fires when limit hit.
- **Test Chat**: in `chat-ai` when `is_test=true`, lazy-reset day counter on first call after KSA midnight, refuse if cap hit, otherwise log + increment.
- **n8n reconciliation**: nightly + hourly `openai-usage-sync` distributes Usage API gap pro-rata by daily chat-turn count.

## Edge functions

| Function | Change |
|---|---|
| `chat-ai/index.ts` | Direct OpenAI with `OPENAI_API_KEY_N8N`. Vision = `gpt-5.4-mini`. Parse `tokenUsageEstimate` from n8n response → log. Honor Test Chat quota gate. |
| `classify-conversation/index.ts` | Direct OpenAI with `OPENAI_API_KEY_INTERNAL`. Model/key from `openai_keys.key_no=2`. Log `source='analysis'`. |
| `openai-usage-sync/index.ts` | **New.** Hourly pg_cron. Pulls Usage API per project, upserts `openai_usage_daily`, runs n8n reconciliation. |
| `admin-server-usage/index.ts` | Per-key MTD totals + cost from `openai_keys` pricing. |
| `admin-subscription-actions/index.ts` | All period-change actions call `archive_and_reset_period`. |
| `process-subscription-expiry/index.ts` | Same. |

## Admin UI placement

**Admin Dashboard layout** (top → bottom):
1. KPI cards (unchanged)
2. New subscribers chart (unchanged)
3. **`استخدام الكلمات / التوكنز`** chart (unchanged)
4. **NEW — full-width** `استهلاك OpenAI حسب المفتاح` table (4 columns × 2 rows: Key 1, Key 2):
   - Columns: المفتاح | الاستخدام / الموديل | إدخال (توكنز / $) | إخراج (توكنز / $) | إجمالي $ | عدد الطلبات (MTD)
   - Bottom row: إجمالي شهري + موازنة المخصص (editable)
5. **`خطط العملاء الحالية`** (unchanged) — sits right after
6. The rest unchanged

**New admin pages:**
- `/admin/openai-keys` — editable Key #, Use, Model, Vision Model, Input $/1M, Output $/1M, Project ID, Notes.
- `/admin/plan-quotas` — Economy/Basic/Professional/Business monthly conversation caps.

**Customer detail page** (`/admin/customers/:id`): full-width **Consumption Table** (same component, scoped to this tenant) sits **below the existing usage chart**, above the actions row. Includes a "الاشتراكات السابقة" collapsible underneath from `subscription_periods`.

## User dashboard UI

Replace "Words used" card with the **Consumption Table** (the same shared component, scoped to the merchant):

| القسم | إدخال | إخراج | إجمالي | التكلفة | المحادثات | ملاحظات |
|---|---|---|---|---|---|---|
| الاشتراك التجريبي | … | … | … | … | n / quota | يظهر فقط إذا توجد فترة تجريبية |
| الاشتراك الحالي | … | … | … | … | n / quota | عدّادات حية |
| تحليل المحادثات | … | … | … | … | عدد المُحلَّلة | مفتاح 2، لا يخصم من الحصة |
| اختبار الذكاء | … | … | … | … | — | يومي: X/300K إدخال، Y/3K إخراج — يُصفّر 00:00 KSA |

Collapsible **الاشتراكات السابقة** below: one row per archived period.

Cost = `(input × input_price + output × output_price) / 1M` using current `openai_keys`.

## Secrets needed (you'll add via secure form after approval)

- `OPENAI_API_KEY_N8N` — Key 1; also pasted into n8n's OpenAI credential.
- `OPENAI_API_KEY_INTERNAL` — Key 2.
- `OPENAI_ADMIN_KEY` — org-level, Usage API read-only.
- `OPENAI_PROJECT_ID_N8N`, `OPENAI_PROJECT_ID_INTERNAL`.

## Non-goals

- No third key.
- No Lovable Gateway.
- No fixed words/token ratio.
- Test Chat never affects merchant conversation count.

## Rollout order

1. Migration: tables + triggers + `archive_and_reset_period` + seed.
2. Edge functions: `chat-ai`, `classify-conversation`, new `openai-usage-sync` + pg_cron.
3. Admin: `/admin/openai-keys`, `/admin/plan-quotas`, new full-width consumption card on Dashboard between the tokens chart and the plans card, same card on customer detail page.
4. Merchant: replace words card with the Consumption Table + Previous Subscriptions section.
5. Retire AI-side word counters in `bump_word_usage`.
