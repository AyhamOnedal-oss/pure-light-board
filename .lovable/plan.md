# Phase 3 — Zid live integration (migration + n8n workflow)

## Part A — Database migration (one call)

Creates 4 objects in Supabase. No changes to `zid_connections` (already complete).

```sql
-- 1) Credentials RPC: n8n calls this once per turn
CREATE OR REPLACE FUNCTION public.get_zid_credentials(p_tenant_id uuid)
RETURNS TABLE (
  store_id text,
  store_uuid text,
  authorization_token text,
  manager_token text,
  token_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id, store_uuid, authorization_token, manager_token, token_expires_at
  FROM public.zid_connections
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND connection_status = 'connected'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_zid_credentials(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_zid_credentials(uuid) TO anon, authenticated;

-- 2) Rate-limit bucket + RPC (Zid limit ~30/min/store; we cap at 25)
CREATE TABLE public.zid_rate_buckets (
  tenant_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, window_start)
);
ALTER TABLE public.zid_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_rate_buckets_member_view ON public.zid_rate_buckets
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.check_zid_rate_limit(
  p_tenant_id uuid,
  p_max integer DEFAULT 25
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
BEGIN
  INSERT INTO public.zid_rate_buckets(tenant_id, window_start, count)
  VALUES (p_tenant_id, v_window, 1)
  ON CONFLICT (tenant_id, window_start)
  DO UPDATE SET count = public.zid_rate_buckets.count + 1
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_zid_rate_limit(uuid, integer) TO anon, authenticated;

-- 3) Error log (per-tenant Zid API failures)
CREATE TABLE public.zid_api_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint text NOT NULL,
  http_status integer,
  request_body jsonb,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zid_api_errors_tenant_created_idx ON public.zid_api_errors(tenant_id, created_at DESC);
ALTER TABLE public.zid_api_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_api_errors_member_view ON public.zid_api_errors
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
-- n8n inserts via service-role (no anon insert policy on purpose).

-- 4) Token refresh errors
CREATE TABLE public.zid_token_refresh_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  http_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zid_token_refresh_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_token_refresh_errors_member_view ON public.zid_token_refresh_errors
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
```

## Part B — Token refresh edge function + daily cron

- New edge function: `supabase/functions/zid-token-refresh/index.ts`
  - Service-role client. Selects all `zid_connections` where `token_expires_at < now() + interval '30 days'` AND `is_active`.
  - For each: `POST https://oauth.zid.sa/oauth/token` with `grant_type=refresh_token`, `refresh_token`, `client_id` (ZID_CLIENT_ID), `client_secret` (ZID_CLIENT_SECRET), `redirect_uri`.
  - On success: update `authorization_token`, `manager_token` (= `access_token`), `refresh_token`, `token_expires_at = now() + (expires_in seconds)`.
  - On failure: insert `zid_token_refresh_errors` row + set `connection_status='refresh_failed'`.
- `supabase/config.toml`: add `[functions.zid-token-refresh] verify_jwt = false`.
- pg_cron schedule (inserted via insert tool, not migration, since it contains the function URL + anon key):
  ```sql
  select cron.schedule(
    'zid-token-refresh-daily',
    '0 3 * * *',
    $$ select net.http_post(
      url:='https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/zid-token-refresh',
      headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
      body:='{}'::jsonb
    ) $$
  );
  ```

---

## Part C — n8n workflow (node-by-node)

Architecture per Zid HTTP tool: every tool is a **3-step sub-flow** wrapped as a single AI Agent "HTTP Tool". The AI Agent passes input args; the sub-flow handles credentials + rate-limit + Zid call + error log.

### Shared constants (set once at top of workflow as a `Set` node "Constants")
| Field | Value |
|---|---|
| `SUPABASE_URL` | `https://kdrcgusinkqgwaafcgnw.supabase.co` |
| `SUPABASE_ANON` | (your anon key, same as widget bundle) |
| `ZID_BASE` | `https://api.zid.sa/v1` |

### Reusable sub-workflow: **"Zid Call"** (one workflow, called by each tool)
Inputs (from caller): `tenant_id`, `endpoint`, `method`, `query` (object), `body` (object|null).

| # | Node type | Settings |
|---|---|---|
| 1 | **HTTP Request** "Get Credentials" | `POST {{$json.SUPABASE_URL}}/rest/v1/rpc/get_zid_credentials` · Headers: `apikey: {{SUPABASE_ANON}}`, `Authorization: Bearer {{SUPABASE_ANON}}`, `Content-Type: application/json` · Body: `{"p_tenant_id":"{{$json.tenant_id}}"}` |
| 2 | **IF** "Has credentials" | `{{$json[0].authorization_token}}` not empty → continue, else → Respond `{ "error": "not_connected" }` |
| 3 | **HTTP Request** "Rate Limit Check" | `POST .../rest/v1/rpc/check_zid_rate_limit` body `{"p_tenant_id":"{{tenant_id}}","p_max":25}` |
| 4 | **IF** "Under limit" | `{{$json === true}}` → continue, else → Respond `{ "error": "rate_limited" }` |
| 5 | **HTTP Request** "Call Zid" | `={{$json.method}} {{ZID_BASE}}{{$json.endpoint}}` · Headers: `Authorization: Bearer {{creds.authorization_token}}`, `X-Manager-Token: {{creds.manager_token}}`, `Accept-Language: ar`, `Accept: application/json` · Query: `={{$json.query}}` · Body: `={{$json.body}}` · **Never fail on HTTP error** (we handle below) |
| 6 | **IF** "HTTP OK" | `{{$json.statusCode < 400}}` → return body, else → branch to error log |
| 7 | **HTTP Request** "Log Error" (error branch) | `POST .../rest/v1/zid_api_errors` with **service role key** in Authorization (stored as n8n credential, NOT in workflow JSON). Body: `{tenant_id, endpoint, http_status, request_body, response_body}` |

### AI Agent tools (8 — each is an HTTP Tool node that calls the "Zid Call" sub-workflow)

| Tool name | When AI uses it | Endpoint (Zid) | Required args from AI |
|---|---|---|---|
| `lookup_order` | customer asks about a specific order | `GET /managers/store/orders/{order_id}` | `order_id` |
| `list_recent_orders_by_phone` | customer asks "where are my orders" without #, gives phone | `GET /managers/store/orders?customer_mobile={phone}&page=1&per_page=5` | `phone` |
| `search_products` | customer asks if a product exists | `GET /products?search={q}&page=1&per_page=10` | `query` |
| `get_product_details` | follow-up on a specific product | `GET /products/{product_id}` | `product_id` |
| `list_categories` | "ايش عندكم أقسام؟" | `GET /categories` | (none) |
| `get_store_policies` | refund / shipping / payment policies | `GET /managers/store/settings` | (none) |
| `find_customer` | identify customer to personalize | `GET /managers/store/customers?search={phone_or_email}` | `phone_or_email` |
| `validate_coupon` | "هل عندي خصم؟" | `GET /managers/store/coupons/{code}` | `code` |

### AI Agent System Message (prepend to merchant prompt)
```
أنت مساعد متجر {{store.name}}. عندك أدوات للوصول لبيانات الطلبات والمنتجات والسياسات.
قواعد:
1. لو العميل سأل عن طلب ولم يعطِ رقم → اطلب رقم الطلب أو رقم الجوال.
2. لو سأل عن منتج ولم يحدد → اسأله الاسم.
3. لا تخترع بيانات. لو الأداة رجعت خطأ، اعتذر واطلب التحقق.
4. ردودك مختصرة، بالعربية الفصحى الميسرة، وتنتهي بسؤال مفتوح "هل تحتاج شيء آخر؟".
tenant_id الحالي: {{$json.tenant_id}}  ← مرّره لكل أداة.
```

### Importable JSON
After you approve, I will generate the full `.json` workflow file (with the 8 tool nodes + the "Zid Call" sub-workflow) and drop it in `/mnt/documents/fuqah-zid-n8n-workflow.json` ready to import via n8n's "Import from File".

---

## Verification checklist (after build)

1. `select get_zid_credentials('<tenant_uuid>');` returns one row.
2. Call `rpc/check_zid_rate_limit` 26 times in a minute → 26th returns `false`.
3. Manually trigger `zid-token-refresh` edge fn → tenants near expiry update.
4. In n8n test panel, run `lookup_order` with a real order id → Zid response in <800ms.
5. Break the access token in DB → next AI call returns error, row appears in `zid_api_errors`.

---

## Open question
Approve this plan and I will (1) run the migration, (2) write the edge function + cron, (3) generate the importable n8n workflow JSON in one go.
