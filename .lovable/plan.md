## Goal

Exact per-tenant OpenAI token/word/cost attribution for every call — n8n agent (+ all its tool reasoning iterations), vision, and classification. No pro-rata.

## Strategy

OpenAI's Usage API supports `group_by=["user_id"]` which returns the exact tokens per attribution identifier per day. Two ways to populate that identifier:

- **Chat Completions API**: send `user: "<tenant_id>"`.
- **Responses API** (what your n8n node uses, model `gpt-5.4-nano`, "Use Responses API" toggle on): send `safety_identifier: "<tenant_id>"`.

Both end up in the same `user_id` column of the Usage API. We set this on every OpenAI call we control, then sync usage every 15 minutes into per-tenant daily tables.

## What gets built

### 1. The n8n change you apply once

In your existing workflow, open the `OpenAI Chat Model1` sub-node:
- **Options → Add Option → Safety Identifier** → value:
  ```
  ={{ $('Get Conversation').item.json.body.tenant_id }}
  ```
- (Optional, recommended) **Options → Add Option → Prompt Cache Key** → same expression. Improves OpenAI's prompt-prefix cache hit rate per merchant → cheaper input tokens. No downside.

That's it for n8n. Every reasoning step the AI Agent makes (including each tool call iteration) inherits this safety_identifier on the underlying OpenAI request.

### 2. Two OpenAI projects + two keys (admin-managed)

- **Key A — `OPENAI_CHAT_KEY`**: used by n8n (you swap n8n's existing OpenAI credential to this key) AND by `chat-ai` for vision. Both live in the same OpenAI project so they roll up together in the Usage API.
- **Key B — `OPENAI_CLASSIFIER_KEY`**: used by `classify-conversation` and any future non-chat AI. Separate OpenAI project so its tokens never mix with chat.

You create both projects + keys in the OpenAI dashboard. We store their `project_id`, label, default model, input/output USD per 1M, and an Arabic-aware tokens-per-word factor in a new `admin_openai_keys` table. Admin UI to edit prices/labels lives between the existing "استخدام الكلمات / التوكنز" panel and "خطط العملاء الحالية" panel.

### 3. Our edge functions: switch to Responses API + tag every call

- **`chat-ai` (vision)**: call `POST https://api.openai.com/v1/responses` with `OPENAI_CHAT_KEY`, `model: gpt-4.1-mini` (vision-capable), and `safety_identifier: tenantId`. Removes Lovable Gateway as you requested.
- **`classify-conversation`**: same — Responses API, `OPENAI_CLASSIFIER_KEY`, `safety_identifier: tenantId`. Removes Lovable Gateway.
- Tiny `_shared/openai.ts` helper that requires `tenantId` as a parameter so future calls can't accidentally skip attribution.

### 4. Usage sync edge function (every 15 minutes)

New `openai-usage-sync` function, triggered by `pg_cron` every 15 min. Each run:

1. For each row in `admin_openai_keys`, calls
   `GET /v1/organization/usage/completions?start_time=<since_last>&bucket_width=1d&group_by[]=project_id&group_by[]=user_id&group_by[]=model`
   using a separate `OPENAI_ADMIN_KEY` (admin key with Usage read scope only).
2. For each `{day, project_id, user_id, model, input_tokens, output_tokens, num_model_requests}` row:
   - `user_id` IS the tenant_id (or `tenant_id:iqtest` for IQ-test calls — see #6).
   - Look up price + tokens/word from `admin_openai_keys` by project_id → compute cost USD + approximate words.
   - Upsert into `merchant_token_daily(tenant_id, day, project_id, model, scope, input_tokens, output_tokens, requests, cost_usd, words_approx, attribution='exact')`.
3. Stores last successful `start_time` in `admin_settings` for incremental polling.
4. Any row where OpenAI returns `user_id=null` (something forgot to tag) goes into `admin_openai_unattributed_daily` so it's visible immediately and fixable — total org spend is never lost.

### 5. Per-tenant breakdown UI (customer detail page)

A wide table styled like the existing customer info tables, showing:
`Day | Project (Chat/Classifier) | Model | Requests | Input tokens | Output tokens | Words ≈ | Cost USD`

Plus a separate summary row **"اختبار المحادثة (IQ test)"** that aggregates `scope='iqtest'` rows (see #6).

### 6. IQ-test tagging (same key, separate tracking)

Per your spec, IQ test uses the same `OPENAI_CHAT_KEY` but tracked separately. When `chat-ai` runs against a `conversations_main.is_test = true` conversation, we send `safety_identifier = "<tenant_id>:iqtest"`. The Usage API returns it as a distinct user_id, so we split it cleanly into `merchant_token_daily.scope='iqtest'`.

Daily caps (300k input / 3k output, Asia/Riyadh midnight reset) are enforced in `chat-ai` by querying `merchant_token_daily` for today's `scope='iqtest'` totals before the call. Over the cap → return the Arabic "لقد وصلت إلى الحد اليومي…" message without calling OpenAI.

Note: usage sync lags ~30–75 min, so cap enforcement uses a fast-path local counter (`iqtest_usage_today` table incremented synchronously on each call) for instant blocking, then reconciled against authoritative Usage API numbers nightly.

### 7. Global "استخدام الكلمات / التوكنز" panel

Replaces the current `ai_classifier_usage`-based view. Reads from `merchant_token_daily` summed across tenants. Monthly chart with two series (Chat project vs Classifier project), exact totals, exact cost.

## Technical details

**New tables**
- `admin_openai_keys` — `id, label, project_id, key_hint, default_model, input_price_per_1m, output_price_per_1m, tokens_per_word, notes`. Seed 2 rows: Chat + Classifier.
- `merchant_token_daily` — `tenant_id, day, project_id, model, scope ('chat'|'iqtest'|'vision'|'classifier'|'other'), input_tokens, output_tokens, requests, cost_usd, words_approx, attribution, updated_at`. Unique on `(tenant_id, day, project_id, model, scope)`.
- `admin_openai_unattributed_daily` — `day, project_id, model, input_tokens, output_tokens, requests`.
- `iqtest_usage_today` — `tenant_id, day, input_tokens, output_tokens, updated_at` (instant cap enforcement counter, reset at 00:00 Asia/Riyadh by cron).

**New secrets**
- `OPENAI_CHAT_KEY` — for `chat-ai` vision + (manually) n8n's OpenAI credential.
- `OPENAI_CLASSIFIER_KEY` — for `classify-conversation`.
- `OPENAI_ADMIN_KEY` — admin key with Usage read scope, only used by `openai-usage-sync`.

**New edge function**
- `openai-usage-sync` — Usage API poller, cron every 15 min.

**Edge function edits**
- `chat-ai`: switch vision to direct OpenAI Responses API with `safety_identifier`; add IQ-test cap check.
- `classify-conversation`: switch from Lovable Gateway to direct OpenAI Responses API with `safety_identifier`.
- New `_shared/openai.ts` helper.

**SQL helpers**
- `admin_merchant_tokens(tenant uuid, _from date, _to date) → table` — per-customer breakdown.
- `admin_tokens_global_monthly(_year int) → table` — chart data.
- `iqtest_can_use(tenant uuid) → boolean` + companion increment function for the cap.

## Honest limitations

1. **~30–75 min lag** on the dashboard chart because Usage API is delayed and we poll every 15 min. Acceptable: quota gating doesn't depend on it.
2. **IQ-test cap** uses an instant local counter (not the Usage API) so blocking is real-time. Nightly reconciliation against OpenAI's authoritative numbers corrects any drift.
3. If any future OpenAI call is added without `safety_identifier`, its tokens land in `admin_openai_unattributed_daily` — visible immediately so it's fixed. Total spend is never lost.
4. The Usage API returns daily buckets per `{user_id, project_id, model}`, not per-request. Per-conversation breakdowns continue to use our existing `conversations_messages` rows.

## Out of scope (this round)

- Hostinger billing integration (waiting on your key).
- Moving the AI agent out of n8n.
- UI styling polish of the new tables — done with existing patterns, can be refined after.
