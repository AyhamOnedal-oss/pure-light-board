
CREATE TABLE IF NOT EXISTS public.admin_subscription_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan text,
  period_start date,
  period_end date,
  chat_conversations int NOT NULL DEFAULT 0,
  chat_input_tokens bigint NOT NULL DEFAULT 0,
  chat_output_tokens bigint NOT NULL DEFAULT 0,
  chat_cost_usd numeric NOT NULL DEFAULT 0,
  analysis_conversations int NOT NULL DEFAULT 0,
  analysis_input_tokens bigint NOT NULL DEFAULT 0,
  analysis_output_tokens bigint NOT NULL DEFAULT 0,
  analysis_cost_usd numeric NOT NULL DEFAULT 0,
  iqtest_input_tokens bigint NOT NULL DEFAULT 0,
  iqtest_output_tokens bigint NOT NULL DEFAULT 0,
  iqtest_cost_usd numeric NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_subscription_periods TO authenticated;
GRANT ALL    ON public.admin_subscription_periods TO service_role;

ALTER TABLE public.admin_subscription_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read subscription periods"
  ON public.admin_subscription_periods
  FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_dashboard'));

CREATE INDEX IF NOT EXISTS admin_subscription_periods_tenant_idx
  ON public.admin_subscription_periods (tenant_id, closed_at DESC);

CREATE TRIGGER admin_subscription_periods_set_updated_at
  BEFORE UPDATE ON public.admin_subscription_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_snapshot_subscription(_tenant uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_period_start date;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_period_start_iso timestamptz;
  v_chat_conv int := 0;
  v_chat_in bigint := 0;
  v_chat_out bigint := 0;
  v_chat_cost numeric := 0;
  v_an_conv int := 0;
  v_an_in bigint := 0;
  v_an_out bigint := 0;
  v_an_cost numeric := 0;
  v_iq_in bigint := 0;
  v_iq_out bigint := 0;
  v_iq_cost numeric := 0;
  v_id uuid;
BEGIN
  SELECT plan INTO v_plan FROM public.settings_workspace WHERE id = _tenant;
  SELECT period_start INTO v_period_start
  FROM public.settings_plans WHERE tenant_id = _tenant;
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now())::date;
  END IF;
  v_period_start_iso := (v_period_start::timestamp AT TIME ZONE 'UTC');

  SELECT
    coalesce(sum(input_tokens),0),
    coalesce(sum(output_tokens),0),
    coalesce(sum(cost_usd),0)
  INTO v_chat_in, v_chat_out, v_chat_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant
    AND day >= v_period_start
    AND day <= v_today
    AND coalesce(scope,'chat') NOT IN ('iqtest','classifier','other');

  SELECT
    coalesce(sum(input_tokens),0),
    coalesce(sum(output_tokens),0),
    coalesce(sum(cost_usd),0)
  INTO v_an_in, v_an_out, v_an_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant
    AND day >= v_period_start
    AND day <= v_today
    AND coalesce(scope,'') IN ('classifier','other');

  SELECT
    coalesce(sum(input_tokens),0),
    coalesce(sum(output_tokens),0),
    coalesce(sum(cost_usd),0)
  INTO v_iq_in, v_iq_out, v_iq_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant
    AND day >= v_period_start
    AND day <= v_today
    AND coalesce(scope,'') = 'iqtest';

  SELECT count(*) INTO v_chat_conv
  FROM public.conversations_main
  WHERE tenant_id = _tenant
    AND coalesce(is_test,false) = false
    AND created_at >= v_period_start_iso;

  SELECT count(*) INTO v_an_conv
  FROM public.conversations_main
  WHERE tenant_id = _tenant
    AND coalesce(analysis_done,false) = true
    AND created_at >= v_period_start_iso;

  INSERT INTO public.admin_subscription_periods (
    tenant_id, plan, period_start, period_end,
    chat_conversations, chat_input_tokens, chat_output_tokens, chat_cost_usd,
    analysis_conversations, analysis_input_tokens, analysis_output_tokens, analysis_cost_usd,
    iqtest_input_tokens, iqtest_output_tokens, iqtest_cost_usd
  ) VALUES (
    _tenant, v_plan, v_period_start, v_today,
    v_chat_conv, v_chat_in, v_chat_out, v_chat_cost,
    v_an_conv, v_an_in, v_an_out, v_an_cost,
    v_iq_in, v_iq_out, v_iq_cost
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_snapshot_subscription(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_snapshot_subscription(uuid) TO service_role;
