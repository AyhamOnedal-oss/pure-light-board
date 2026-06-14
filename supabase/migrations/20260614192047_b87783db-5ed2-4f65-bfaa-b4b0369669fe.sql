
-- Add tracking columns
ALTER TABLE public.settings_plans
  ADD COLUMN IF NOT EXISTS low_balance_emailed_period date,
  ADD COLUMN IF NOT EXISTS last_renewal_emailed_for_end date;

-- Seed webhook secrets and URLs (only insert if missing)
INSERT INTO public._app_secrets (key, value)
VALUES
  ('low_balance_webhook_secret', encode(gen_random_bytes(24), 'hex')),
  ('low_balance_webhook_url', 'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/send-low-balance-warning'),
  ('renewal_confirmation_webhook_secret', encode(gen_random_bytes(24), 'hex')),
  ('renewal_confirmation_webhook_url', 'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/send-renewal-confirmation')
ON CONFLICT (key) DO NOTHING;

-- Update bump_word_usage to also fire low-balance email at 80%
CREATE OR REPLACE FUNCTION public.bump_word_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_words integer := COALESCE(NEW.word_count, 0);
  v_today date := (now() at time zone 'utc')::date;
  v_period_start date := (date_trunc('month', now()))::date;
  v_attachment_count integer := 0;
  v_attachment_surcharge integer := 0;
  v_prev_used integer;
  v_prev_period date;
  v_quota integer;
  v_emailed_period date;
  v_low_emailed_period date;
  v_new_used integer;
  v_secret text;
  v_url text;
  v_low_threshold integer;
BEGIN
  IF v_words <= 0 THEN
    v_words := GREATEST(array_length(regexp_split_to_array(COALESCE(NEW.body,''), '\s+'), 1), 0);
  END IF;

  IF NEW.sender = 'customer' AND NEW.attachments IS NOT NULL THEN
    v_attachment_count := jsonb_array_length(NEW.attachments);
    v_attachment_surcharge := v_attachment_count * 750;
  END IF;

  SELECT monthly_words_used, period_start, monthly_word_quota,
         service_paused_emailed_period, low_balance_emailed_period
    INTO v_prev_used, v_prev_period, v_quota, v_emailed_period, v_low_emailed_period
  FROM public.settings_plans
  WHERE tenant_id = NEW.tenant_id;

  UPDATE public.settings_plans
  SET monthly_words_used = CASE
        WHEN period_start < v_period_start THEN v_words + v_attachment_surcharge
        ELSE monthly_words_used + v_words + v_attachment_surcharge
      END,
      period_start = CASE
        WHEN period_start < v_period_start THEN v_period_start
        ELSE period_start
      END,
      updated_at = now()
  WHERE tenant_id = NEW.tenant_id
  RETURNING monthly_words_used INTO v_new_used;

  INSERT INTO public.dashboard_usage_daily (tenant_id, day, ai_words_used, messages_in, messages_out)
  VALUES (
    NEW.tenant_id, v_today,
    CASE WHEN NEW.sender = 'ai' THEN v_words ELSE v_attachment_surcharge END,
    CASE WHEN NEW.sender = 'customer' THEN 1 ELSE 0 END,
    CASE WHEN NEW.sender = 'ai' THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, day) DO UPDATE
  SET ai_words_used = public.dashboard_usage_daily.ai_words_used + EXCLUDED.ai_words_used,
      messages_in   = public.dashboard_usage_daily.messages_in   + EXCLUDED.messages_in,
      messages_out  = public.dashboard_usage_daily.messages_out  + EXCLUDED.messages_out,
      updated_at = now();

  -- Low-balance warning at 80% (once per period, only if below 100%)
  IF v_quota IS NOT NULL AND v_quota > 0 THEN
    v_low_threshold := (v_quota * 80) / 100;
    IF v_new_used >= v_low_threshold
       AND v_new_used < v_quota
       AND (v_prev_used IS NULL OR v_prev_used < v_low_threshold OR v_prev_period < v_period_start)
       AND (v_low_emailed_period IS NULL OR v_low_emailed_period < v_period_start)
    THEN
      SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'low_balance_webhook_secret';
      SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'low_balance_webhook_url';
      IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
        PERFORM net.http_post(
          url     := v_url,
          headers := jsonb_build_object('Content-Type','application/json','x-low-balance-secret', v_secret),
          body    := jsonb_build_object('tenant_id', NEW.tenant_id)
        );
      END IF;
      UPDATE public.settings_plans SET low_balance_emailed_period = v_period_start WHERE tenant_id = NEW.tenant_id;
    END IF;
  END IF;

  -- Service paused at 100%
  IF v_quota IS NOT NULL AND v_quota > 0
     AND v_new_used >= v_quota
     AND (v_prev_used IS NULL OR v_prev_used < v_quota OR v_prev_period < v_period_start)
     AND (v_emailed_period IS NULL OR v_emailed_period < v_period_start)
  THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'service_paused_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'service_paused_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-service-paused-secret', v_secret),
        body    := jsonb_build_object('tenant_id', NEW.tenant_id)
      );
    END IF;
    UPDATE public.settings_plans SET service_paused_emailed_period = v_period_start WHERE tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Renewal confirmation: trigger on settings_plans when subscription_end_date is extended
CREATE OR REPLACE FUNCTION public.notify_subscription_renewed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF NEW.subscription_end_date IS NOT NULL
     AND (OLD.subscription_end_date IS NULL OR NEW.subscription_end_date > OLD.subscription_end_date)
     AND (NEW.last_renewal_emailed_for_end IS NULL
          OR NEW.last_renewal_emailed_for_end <> NEW.subscription_end_date)
  THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'renewal_confirmation_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'renewal_confirmation_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-renewal-secret', v_secret),
        body    := jsonb_build_object('tenant_id', NEW.tenant_id)
      );
    END IF;
    NEW.last_renewal_emailed_for_end := NEW.subscription_end_date;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS settings_plans_notify_renewal ON public.settings_plans;
CREATE TRIGGER settings_plans_notify_renewal
  BEFORE UPDATE ON public.settings_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_renewed();
