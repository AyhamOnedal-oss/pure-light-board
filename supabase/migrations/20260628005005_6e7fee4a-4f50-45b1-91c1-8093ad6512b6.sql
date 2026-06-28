
CREATE TABLE IF NOT EXISTS public.admin_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('plan_change','usage_80','resubscribe','impersonation')),
  actor_user_id uuid,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_activity_events TO authenticated;
GRANT ALL ON public.admin_activity_events TO service_role;

ALTER TABLE public.admin_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all activity events"
  ON public.admin_activity_events FOR SELECT
  TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'customer_management')
         OR public.has_role(auth.uid(), 'super_admin'::app_role)
         OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS admin_activity_events_tenant_created_idx
  ON public.admin_activity_events (tenant_id, created_at DESC);

-- Plan change trigger on settings_workspace
CREATE OR REPLACE FUNCTION public.log_plan_change_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.plan,'') <> COALESCE(OLD.plan,'') AND COALESCE(NEW.plan,'') <> '' THEN
    INSERT INTO public.admin_activity_events (tenant_id, event_type, metadata)
    VALUES (NEW.id, 'plan_change', jsonb_build_object('from_plan', OLD.plan, 'to_plan', NEW.plan));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_plan_change ON public.settings_workspace;
CREATE TRIGGER trg_log_plan_change
AFTER UPDATE OF plan ON public.settings_workspace
FOR EACH ROW EXECUTE FUNCTION public.log_plan_change_event();

-- 80% usage trigger on settings_plans
CREATE OR REPLACE FUNCTION public.log_usage_80_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota int := COALESCE(NEW.monthly_word_quota, 0);
  v_new int := COALESCE(NEW.monthly_words_used, 0);
  v_old int := COALESCE(OLD.monthly_words_used, 0);
  v_threshold int;
  v_period date := COALESCE(NEW.period_start, (date_trunc('month', now()))::date);
BEGIN
  IF v_quota <= 0 THEN RETURN NEW; END IF;
  v_threshold := (v_quota * 80) / 100;
  IF v_new >= v_threshold
     AND (v_old < v_threshold OR COALESCE(OLD.period_start, v_period) < v_period) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_activity_events
      WHERE tenant_id = NEW.tenant_id
        AND event_type = 'usage_80'
        AND (metadata->>'period_start') = v_period::text
    ) THEN
      INSERT INTO public.admin_activity_events (tenant_id, event_type, metadata)
      VALUES (NEW.tenant_id, 'usage_80',
              jsonb_build_object('period_start', v_period::text,
                                 'words_used', v_new,
                                 'quota', v_quota));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_usage_80 ON public.settings_plans;
CREATE TRIGGER trg_log_usage_80
AFTER UPDATE OF monthly_words_used, monthly_word_quota, period_start ON public.settings_plans
FOR EACH ROW EXECUTE FUNCTION public.log_usage_80_event();
