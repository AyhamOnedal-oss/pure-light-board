
-- 1. Ensure every workspace has a settings_plans row
INSERT INTO public.settings_plans (tenant_id, conversation_quota)
SELECT w.id, public.plan_default_conversation_quota(w.plan)
FROM public.settings_workspace w
LEFT JOIN public.settings_plans p ON p.tenant_id = w.id
WHERE p.tenant_id IS NULL;

-- 2. Trigger: auto-create settings_plans row when a workspace is inserted
CREATE OR REPLACE FUNCTION public.ensure_settings_plans_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.settings_plans (tenant_id, conversation_quota)
  VALUES (NEW.id, public.plan_default_conversation_quota(NEW.plan))
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS settings_workspace_ensure_plan_row ON public.settings_workspace;
CREATE TRIGGER settings_workspace_ensure_plan_row
  AFTER INSERT ON public.settings_workspace
  FOR EACH ROW EXECUTE FUNCTION public.ensure_settings_plans_row();

-- 3. Rewrite plan-sync trigger to upsert (INSERT ... ON CONFLICT)
CREATE OR REPLACE FUNCTION public.sync_conversation_quota_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR coalesce(NEW.plan,'') IS DISTINCT FROM coalesce(OLD.plan,'') THEN
    INSERT INTO public.settings_plans (tenant_id, conversation_quota)
    VALUES (NEW.id, public.plan_default_conversation_quota(NEW.plan))
    ON CONFLICT (tenant_id) DO UPDATE
      SET conversation_quota = public.plan_default_conversation_quota(NEW.plan),
          updated_at = now();
  END IF;
  RETURN NEW;
END $$;

-- 4. Re-sync conversations_used from actual conversations_main data
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

-- 5. Atomic upsert RPC for per-tenant token accounting
CREATE OR REPLACE FUNCTION public.merchant_token_daily_bump(
  _tenant uuid,
  _project_id text,
  _model text,
  _scope text,
  _input_tokens bigint,
  _output_tokens bigint,
  _cost_usd numeric DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in bigint := GREATEST(coalesce(_input_tokens,0), 0);
  v_out bigint := GREATEST(coalesce(_output_tokens,0), 0);
  v_words bigint := ((v_in + v_out) * 3 / 4);
BEGIN
  IF _tenant IS NULL THEN RETURN; END IF;
  INSERT INTO public.merchant_token_daily
    (tenant_id, day, project_id, model, scope,
     input_tokens, output_tokens, requests, cost_usd, words_approx, updated_at)
  VALUES
    (_tenant, public.riyadh_today(), coalesce(_project_id,''), coalesce(_model,''), coalesce(_scope,'chat'),
     v_in, v_out, 1, coalesce(_cost_usd,0), v_words, now())
  ON CONFLICT (tenant_id, day, project_id, model, scope) DO UPDATE
    SET input_tokens = public.merchant_token_daily.input_tokens + EXCLUDED.input_tokens,
        output_tokens = public.merchant_token_daily.output_tokens + EXCLUDED.output_tokens,
        requests = public.merchant_token_daily.requests + 1,
        cost_usd = public.merchant_token_daily.cost_usd + EXCLUDED.cost_usd,
        words_approx = public.merchant_token_daily.words_approx + EXCLUDED.words_approx,
        updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.merchant_token_daily_bump(uuid,text,text,text,bigint,bigint,numeric) TO authenticated, service_role;
