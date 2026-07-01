
-- 1) Freeze trial figures: remember when each tenant transitioned to a paid plan.
ALTER TABLE public.settings_plans
  ADD COLUMN IF NOT EXISTS trial_ended_at timestamptz;

-- Backfill from admin_activity_events (first plan_change → trial_ended_at)
UPDATE public.settings_plans sp
SET trial_ended_at = ev.first_at
FROM (
  SELECT tenant_id, min(created_at) AS first_at
  FROM public.admin_activity_events
  WHERE event_type = 'plan_change'
    AND lower(coalesce(metadata->>'to_plan','')) IN ('economy','basic','professional','business','pro')
  GROUP BY tenant_id
) ev
WHERE sp.tenant_id = ev.tenant_id AND sp.trial_ended_at IS NULL;

-- For paid tenants without an event trail, fall back to workspace creation + 14 days.
UPDATE public.settings_plans sp
SET trial_ended_at = COALESCE(sp.trial_ended_at, w.created_at + interval '14 days')
FROM public.settings_workspace w
WHERE sp.tenant_id = w.id
  AND sp.trial_ended_at IS NULL
  AND lower(coalesce(w.plan,'')) IN ('economy','basic','professional','business','pro');

-- Trigger: set trial_ended_at when a tenant first moves onto a paid plan.
CREATE OR REPLACE FUNCTION public.set_trial_ended_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF lower(coalesce(NEW.plan,'')) IN ('economy','basic','professional','business','pro')
     AND lower(coalesce(OLD.plan,'')) NOT IN ('economy','basic','professional','business','pro')
  THEN
    UPDATE public.settings_plans
       SET trial_ended_at = COALESCE(trial_ended_at, now())
     WHERE tenant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_trial_ended_at ON public.settings_workspace;
CREATE TRIGGER trg_set_trial_ended_at
  AFTER UPDATE OF plan ON public.settings_workspace
  FOR EACH ROW EXECUTE FUNCTION public.set_trial_ended_at();

-- 2) OpenAI dollar-balance setting (admin top-up).
CREATE OR REPLACE FUNCTION public.admin_set_openai_dollar_balance(_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  INSERT INTO public.admin_settings (key, value, updated_at, updated_by)
  VALUES ('openai_dollar_balance', to_jsonb(_amount), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  RETURN _amount;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_openai_dollar_balance(numeric) TO authenticated;

-- 3) Extend admin_openai_usage to include dollar-balance fields.
CREATE OR REPLACE FUNCTION public.admin_openai_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_budget_words bigint := 0;
  v_tokens bigint := 0;
  v_words bigint := 0;
  v_percent numeric := 0;
  v_period_start timestamptz;
  v_dollar_balance numeric := 0;
  v_used_usd numeric := 0;
  v_remaining_usd numeric := 0;
  v_percent_usd numeric := 0;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE((value)::text::bigint, 0) INTO v_budget_words
  FROM public.admin_settings WHERE key = 'openai_monthly_word_budget';

  SELECT COALESCE((value)::text::numeric, 0) INTO v_dollar_balance
  FROM public.admin_settings WHERE key = 'openai_dollar_balance';

  v_period_start := date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh'))
                    AT TIME ZONE 'Asia/Riyadh';

  SELECT COALESCE(SUM(total_tokens), 0)::bigint INTO v_tokens
  FROM public.ai_classifier_usage
  WHERE created_at >= v_period_start;

  v_words := (v_tokens::numeric * 0.75)::bigint;

  IF v_budget_words > 0 THEN
    v_percent := LEAST(100, ROUND((v_words::numeric / v_budget_words::numeric) * 100, 2));
  END IF;

  -- Dollar usage: sum cost_usd across ALL merchant rows this month.
  SELECT COALESCE(SUM(cost_usd), 0)::numeric INTO v_used_usd
  FROM public.merchant_token_daily
  WHERE day >= (v_period_start)::date;

  v_remaining_usd := GREATEST(0, v_dollar_balance - v_used_usd);
  IF v_dollar_balance > 0 THEN
    v_percent_usd := LEAST(100, ROUND((v_used_usd / v_dollar_balance) * 100, 2));
  END IF;

  RETURN jsonb_build_object(
    'budget_words',   v_budget_words,
    'used_tokens',    v_tokens,
    'used_words',     v_words,
    'percent',        v_percent,
    'period_start',   v_period_start,
    'dollar_balance', v_dollar_balance,
    'used_usd',       ROUND(v_used_usd, 4),
    'remaining_usd',  ROUND(v_remaining_usd, 4),
    'percent_usd',    v_percent_usd
  );
END;
$$;

-- 4) Cost by slot: iqtest now resolves through admin_openai_keys.slot='iqtest' when configured.
CREATE OR REPLACE FUNCTION public.admin_openai_cost_by_slot()
 RETURNS TABLE(slot text, cost_usd numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_iq_proj text;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT project_id INTO v_iq_proj FROM public.admin_openai_keys WHERE slot = 'iqtest' LIMIT 1;

  RETURN QUERY
  WITH k AS (
    SELECT slot, project_id FROM public.admin_openai_keys WHERE project_id IS NOT NULL
  ),
  chat_cost AS (
    SELECT coalesce(sum(d.cost_usd),0)::numeric AS c
    FROM public.merchant_token_daily d
    JOIN k ON k.project_id = d.project_id AND k.slot = 'chat'
    WHERE coalesce(d.scope,'') <> 'iqtest'
  ),
  classifier_cost AS (
    SELECT coalesce(sum(d.cost_usd),0)::numeric AS c
    FROM public.merchant_token_daily d
    JOIN k ON k.project_id = d.project_id AND k.slot = 'classifier'
  ),
  iqtest_cost AS (
    SELECT coalesce(sum(d.cost_usd),0)::numeric AS c
    FROM public.merchant_token_daily d
    WHERE coalesce(d.scope,'') = 'iqtest'
      AND (v_iq_proj IS NULL OR d.project_id = v_iq_proj)
  )
  SELECT 'chat'::text,       (SELECT c FROM chat_cost)
  UNION ALL SELECT 'classifier'::text, (SELECT c FROM classifier_cost)
  UNION ALL SELECT 'iqtest'::text,     (SELECT c FROM iqtest_cost);
END;
$$;
