
-- 1. Columns
ALTER TABLE public.settings_plans
  ADD COLUMN IF NOT EXISTS conversation_quota  integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS conversation_topup  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversations_used  integer NOT NULL DEFAULT 0;

-- 2. Default quota lookup
CREATE OR REPLACE FUNCTION public.plan_default_conversation_quota(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan,''))
    WHEN 'economy'      THEN 250
    WHEN 'basic'        THEN 500
    WHEN 'professional' THEN 750
    WHEN 'pro'          THEN 750
    WHEN 'business'     THEN 1000
    ELSE 50
  END;
$$;

-- 3. Sync quota when plan changes on settings_workspace
CREATE OR REPLACE FUNCTION public.sync_conversation_quota_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR coalesce(NEW.plan,'') IS DISTINCT FROM coalesce(OLD.plan,'') THEN
    UPDATE public.settings_plans
      SET conversation_quota = public.plan_default_conversation_quota(NEW.plan),
          updated_at = now()
    WHERE tenant_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS settings_workspace_sync_conv_quota ON public.settings_workspace;
CREATE TRIGGER settings_workspace_sync_conv_quota
  AFTER INSERT OR UPDATE OF plan ON public.settings_workspace
  FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_quota_from_plan();

-- 4. Cached counter on conversations_main
CREATE OR REPLACE FUNCTION public.bump_conversations_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.is_test,false) = false THEN
      UPDATE public.settings_plans
        SET conversations_used = conversations_used + 1,
            updated_at = now()
      WHERE tenant_id = NEW.tenant_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF coalesce(OLD.is_test,false) = false THEN
      UPDATE public.settings_plans
        SET conversations_used = GREATEST(0, conversations_used - 1),
            updated_at = now()
      WHERE tenant_id = OLD.tenant_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS conversations_main_bump_used_ins ON public.conversations_main;
CREATE TRIGGER conversations_main_bump_used_ins
  AFTER INSERT ON public.conversations_main
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversations_used();

DROP TRIGGER IF EXISTS conversations_main_bump_used_del ON public.conversations_main;
CREATE TRIGGER conversations_main_bump_used_del
  AFTER DELETE ON public.conversations_main
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversations_used();

-- 5. Backfill quotas + counters for existing rows
UPDATE public.settings_plans sp
   SET conversation_quota = public.plan_default_conversation_quota(w.plan)
  FROM public.settings_workspace w
 WHERE w.id = sp.tenant_id;

WITH counts AS (
  SELECT c.tenant_id, count(*)::int AS n
  FROM public.conversations_main c
  LEFT JOIN public.settings_plans sp ON sp.tenant_id = c.tenant_id
  WHERE coalesce(c.is_test,false) = false
    AND c.created_at >= coalesce((sp.period_start::timestamp AT TIME ZONE 'UTC'),
                                 date_trunc('month', now()))
  GROUP BY c.tenant_id
)
UPDATE public.settings_plans sp
   SET conversations_used = coalesce(counts.n, 0)
  FROM counts
 WHERE counts.tenant_id = sp.tenant_id;

-- 6. Extend admin_snapshot_subscription to reset conversation counters on cycle rollover
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

  SELECT coalesce(sum(input_tokens),0), coalesce(sum(output_tokens),0), coalesce(sum(cost_usd),0)
  INTO v_chat_in, v_chat_out, v_chat_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant AND day >= v_period_start AND day <= v_today
    AND coalesce(scope,'chat') NOT IN ('iqtest','classifier','other');

  SELECT coalesce(sum(input_tokens),0), coalesce(sum(output_tokens),0), coalesce(sum(cost_usd),0)
  INTO v_an_in, v_an_out, v_an_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant AND day >= v_period_start AND day <= v_today
    AND coalesce(scope,'') IN ('classifier','other');

  SELECT coalesce(sum(input_tokens),0), coalesce(sum(output_tokens),0), coalesce(sum(cost_usd),0)
  INTO v_iq_in, v_iq_out, v_iq_cost
  FROM public.merchant_token_daily
  WHERE tenant_id = _tenant AND day >= v_period_start AND day <= v_today
    AND coalesce(scope,'') = 'iqtest';

  SELECT count(*) INTO v_chat_conv
  FROM public.conversations_main
  WHERE tenant_id = _tenant AND coalesce(is_test,false) = false
    AND created_at >= v_period_start_iso;

  SELECT count(*) INTO v_an_conv
  FROM public.conversations_main
  WHERE tenant_id = _tenant AND coalesce(analysis_done,false) = true
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

  -- Reset per-cycle conversation counters after snapshotting
  UPDATE public.settings_plans
     SET conversations_used = 0,
         conversation_topup = 0,
         updated_at = now()
   WHERE tenant_id = _tenant;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_snapshot_subscription(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_snapshot_subscription(uuid) TO service_role;
