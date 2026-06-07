
-- 1. Subscription expiry tracking
ALTER TABLE public.settings_plans
  ADD COLUMN IF NOT EXISTS subscription_end_date date,
  ADD COLUMN IF NOT EXISTS expired_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_warned_for_date date;

-- 2. Register URLs + secrets for new triggers/cron
INSERT INTO public._app_secrets (key, value) VALUES
  ('ticket_status_webhook_url',         'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/send-ticket-status-updated'),
  ('ticket_status_webhook_secret',      encode(gen_random_bytes(32), 'hex')),
  ('subscription_expiry_webhook_url',   'https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/process-subscription-expiry'),
  ('subscription_expiry_webhook_secret',encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 3. Ticket status change trigger
CREATE OR REPLACE FUNCTION public.notify_ticket_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'ticket_status_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'ticket_status_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ticket-status-secret', v_secret
        ),
        body    := jsonb_build_object('tenant_id', NEW.tenant_id, 'ticket_id', NEW.id, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickets_main_notify_status ON public.tickets_main;
CREATE TRIGGER tickets_main_notify_status
  AFTER UPDATE OF status ON public.tickets_main
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_changed();

-- 4. Daily cron job — runs the expiry processor at 06:00 UTC (09:00 Riyadh)
DO $$
DECLARE
  v_secret text;
  v_url text;
  v_existing int;
BEGIN
  SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'subscription_expiry_webhook_secret';
  SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'subscription_expiry_webhook_url';
  SELECT count(*) INTO v_existing FROM cron.job WHERE jobname = 'subscription_expiry_daily';
  IF v_existing > 0 THEN
    PERFORM cron.unschedule('subscription_expiry_daily');
  END IF;
  PERFORM cron.schedule(
    'subscription_expiry_daily',
    '0 6 * * *',
    format(
      $cmd$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-expiry-secret',%L), body := '{}'::jsonb);$cmd$,
      v_url, v_secret
    )
  );
END$$;
