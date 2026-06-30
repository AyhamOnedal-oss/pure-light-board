
-- ============================================================================
-- OpenAI per-tenant exact attribution + admin keys + usage sync
-- ============================================================================

-- 1) admin_openai_keys: rows the admin edits to label projects, set prices,
--    and choose tokens/word for Arabic-aware approximation.
CREATE TABLE IF NOT EXISTS public.admin_openai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL UNIQUE,                  -- 'chat' | 'classifier'
  label text NOT NULL,
  project_id text,                            -- OpenAI project id (proj_...)
  key_hint text,                              -- last 4 chars for UX only
  default_model text NOT NULL,
  input_price_per_1m numeric NOT NULL DEFAULT 0,
  output_price_per_1m numeric NOT NULL DEFAULT 0,
  tokens_per_word numeric NOT NULL DEFAULT 3.3,  -- Arabic-leaning default
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_openai_keys TO authenticated;
GRANT ALL ON public.admin_openai_keys TO service_role;
ALTER TABLE public.admin_openai_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_openai_keys_admin_read
  ON public.admin_openai_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_openai_keys_service_all
  ON public.admin_openai_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed the two slots
INSERT INTO public.admin_openai_keys (slot, label, default_model, input_price_per_1m, output_price_per_1m, tokens_per_word, notes)
VALUES
  ('chat',       'Chat & Vision (n8n + chat-ai)', 'gpt-5.4-nano',   0.20, 1.25, 3.3, 'Used by n8n AI Agent and chat-ai vision'),
  ('classifier', 'Classification (post-chat)',    'gpt-4.1-mini',   0.40, 1.60, 3.3, 'Used by chat-ai intent classifier and classify-conversation')
ON CONFLICT (slot) DO NOTHING;

-- 2) merchant_token_daily: exact per-tenant usage from OpenAI Usage API.
CREATE TABLE IF NOT EXISTS public.merchant_token_daily (
  tenant_id uuid NOT NULL,
  day date NOT NULL,
  project_id text NOT NULL DEFAULT 'unknown',
  model text NOT NULL DEFAULT 'unknown',
  scope text NOT NULL DEFAULT 'chat',         -- 'chat'|'iqtest'|'vision'|'classifier'|'other'
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  requests bigint NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  words_approx bigint NOT NULL DEFAULT 0,
  attribution text NOT NULL DEFAULT 'exact',  -- exact | local-estimate
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day, project_id, model, scope)
);

CREATE INDEX IF NOT EXISTS merchant_token_daily_tenant_day_idx
  ON public.merchant_token_daily(tenant_id, day DESC);
CREATE INDEX IF NOT EXISTS merchant_token_daily_day_idx
  ON public.merchant_token_daily(day DESC);

GRANT SELECT ON public.merchant_token_daily TO authenticated;
GRANT ALL ON public.merchant_token_daily TO service_role;
ALTER TABLE public.merchant_token_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY mtd_admin_read
  ON public.merchant_token_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY mtd_tenant_read
  ON public.merchant_token_daily FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auth_tenant_members m
                 WHERE m.tenant_id = merchant_token_daily.tenant_id
                   AND m.user_id = auth.uid()));
CREATE POLICY mtd_service_all
  ON public.merchant_token_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Catch-all for OpenAI rows that arrived without a safety_identifier.
CREATE TABLE IF NOT EXISTS public.admin_openai_unattributed_daily (
  day date NOT NULL,
  project_id text NOT NULL DEFAULT 'unknown',
  model text NOT NULL DEFAULT 'unknown',
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  requests bigint NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, project_id, model)
);

GRANT SELECT ON public.admin_openai_unattributed_daily TO authenticated;
GRANT ALL  ON public.admin_openai_unattributed_daily TO service_role;
ALTER TABLE public.admin_openai_unattributed_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY uad_admin_read
  ON public.admin_openai_unattributed_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY uad_service_all
  ON public.admin_openai_unattributed_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) IQ-test instant cap counter (Asia/Riyadh day reset).
CREATE TABLE IF NOT EXISTS public.iqtest_usage_today (
  tenant_id uuid NOT NULL,
  riyadh_day date NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  requests bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, riyadh_day)
);

GRANT SELECT ON public.iqtest_usage_today TO authenticated;
GRANT ALL ON public.iqtest_usage_today TO service_role;
ALTER TABLE public.iqtest_usage_today ENABLE ROW LEVEL SECURITY;

CREATE POLICY iqut_tenant_read
  ON public.iqtest_usage_today FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auth_tenant_members m
                 WHERE m.tenant_id = iqtest_usage_today.tenant_id
                   AND m.user_id = auth.uid()));
CREATE POLICY iqut_admin_read
  ON public.iqtest_usage_today FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY iqut_service_all
  ON public.iqtest_usage_today FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5) Helper RPCs

-- Today in Riyadh as a date
CREATE OR REPLACE FUNCTION public.riyadh_today()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Asia/Riyadh')::date
$$;

-- Increment IQ-test counter (called BEFORE the OpenAI call from chat-ai).
CREATE OR REPLACE FUNCTION public.iqtest_increment(
  _tenant uuid, _input_tokens bigint, _output_tokens bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.iqtest_usage_today (tenant_id, riyadh_day, input_tokens, output_tokens, requests, updated_at)
  VALUES (_tenant, public.riyadh_today(), GREATEST(_input_tokens,0), GREATEST(_output_tokens,0), 1, now())
  ON CONFLICT (tenant_id, riyadh_day) DO UPDATE
  SET input_tokens = iqtest_usage_today.input_tokens + EXCLUDED.input_tokens,
      output_tokens = iqtest_usage_today.output_tokens + EXCLUDED.output_tokens,
      requests = iqtest_usage_today.requests + 1,
      updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.iqtest_increment(uuid,bigint,bigint) TO service_role;

-- Check if a tenant is under the daily IQ-test cap.
-- Caps are: 300,000 input tokens / 3,000 output tokens per Riyadh day.
CREATE OR REPLACE FUNCTION public.iqtest_can_use(_tenant uuid)
RETURNS TABLE(allowed boolean, input_used bigint, output_used bigint,
              input_cap bigint, output_cap bigint, resets_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _in bigint := 0; _out bigint := 0;
  _in_cap bigint := 300000;
  _out_cap bigint := 3000;
BEGIN
  SELECT input_tokens, output_tokens INTO _in, _out
  FROM public.iqtest_usage_today
  WHERE tenant_id = _tenant AND riyadh_day = public.riyadh_today();
  _in := COALESCE(_in, 0);
  _out := COALESCE(_out, 0);
  RETURN QUERY SELECT
    (_in < _in_cap AND _out < _out_cap),
    _in, _out, _in_cap, _out_cap,
    ((public.riyadh_today() + 1)::timestamp AT TIME ZONE 'Asia/Riyadh');
END $$;

GRANT EXECUTE ON FUNCTION public.iqtest_can_use(uuid) TO authenticated, service_role;

-- Per-customer breakdown for the admin customer detail page.
CREATE OR REPLACE FUNCTION public.admin_merchant_tokens(
  _tenant uuid, _from date DEFAULT (current_date - 29), _to date DEFAULT current_date
)
RETURNS TABLE(
  day date, project_id text, model text, scope text,
  input_tokens bigint, output_tokens bigint, requests bigint,
  words_approx bigint, cost_usd numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT day, project_id, model, scope,
         input_tokens, output_tokens, requests,
         words_approx, cost_usd
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant AND day BETWEEN _from AND _to
  ORDER BY day DESC, scope, project_id, model;
$$;

GRANT EXECUTE ON FUNCTION public.admin_merchant_tokens(uuid,date,date) TO authenticated, service_role;

-- Global monthly aggregation for the dashboard chart.
CREATE OR REPLACE FUNCTION public.admin_tokens_global_monthly(_year int)
RETURNS TABLE(
  month int, slot text, project_id text,
  input_tokens bigint, output_tokens bigint, requests bigint,
  words_approx bigint, cost_usd numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH k AS (SELECT project_id, slot FROM public.admin_openai_keys WHERE project_id IS NOT NULL)
  SELECT EXTRACT(MONTH FROM d.day)::int AS month,
         COALESCE(k.slot, 'other') AS slot,
         d.project_id,
         SUM(d.input_tokens)::bigint,
         SUM(d.output_tokens)::bigint,
         SUM(d.requests)::bigint,
         SUM(d.words_approx)::bigint,
         SUM(d.cost_usd)::numeric
  FROM public.merchant_token_daily d
  LEFT JOIN k ON k.project_id = d.project_id
  WHERE EXTRACT(YEAR FROM d.day)::int = _year
  GROUP BY 1,2,3
  ORDER BY 1,2,3;
$$;

GRANT EXECUTE ON FUNCTION public.admin_tokens_global_monthly(int) TO authenticated, service_role;

-- 6) admin_settings keys for the usage sync poller (last successful start_time).
INSERT INTO public.admin_settings (key, value)
VALUES ('openai_usage_last_start_time', to_jsonb(extract(epoch from (now() - interval '2 days'))::bigint::text))
ON CONFLICT (key) DO NOTHING;

-- 7) Schedule openai-usage-sync every 15 minutes (uses pg_cron + pg_net).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('openai-usage-sync-15m')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'openai-usage-sync-15m');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
