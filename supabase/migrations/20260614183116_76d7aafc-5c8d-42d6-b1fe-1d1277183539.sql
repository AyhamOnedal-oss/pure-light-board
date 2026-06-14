-- 1. Idempotency column
ALTER TABLE public.tickets_main
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- 2. Replace AFTER INSERT trigger with AFTER UPDATE trigger
DROP TRIGGER IF EXISTS trg_notify_ticket_received ON public.tickets_main;
DROP TRIGGER IF EXISTS notify_ticket_received ON public.tickets_main;

CREATE OR REPLACE FUNCTION public.notify_ticket_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  -- Fire once, when subject + description are first present and we haven't sent yet
  IF NEW.email_sent_at IS NULL
     AND NEW.subject IS NOT NULL AND length(btrim(NEW.subject)) > 0
     AND NEW.description IS NOT NULL AND length(btrim(NEW.description)) > 0
  THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'ticket_email_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'ticket_email_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ticket-secret', v_secret
        ),
        body    := jsonb_build_object('tenant_id', NEW.tenant_id, 'ticket_id', NEW.id)
      );
      NEW.email_sent_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- BEFORE UPDATE so we can set email_sent_at on the same row write
CREATE TRIGGER trg_notify_ticket_received
BEFORE UPDATE ON public.tickets_main
FOR EACH ROW
WHEN (
  (OLD.subject IS DISTINCT FROM NEW.subject OR OLD.description IS DISTINCT FROM NEW.description)
  AND NEW.email_sent_at IS NULL
)
EXECUTE FUNCTION public.notify_ticket_received();

-- Also fire on INSERT if the row already arrives with subject + description (non-widget paths)
CREATE OR REPLACE FUNCTION public.notify_ticket_received_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF NEW.email_sent_at IS NULL
     AND NEW.subject IS NOT NULL AND length(btrim(NEW.subject)) > 0
     AND NEW.description IS NOT NULL AND length(btrim(NEW.description)) > 0
  THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'ticket_email_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'ticket_email_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-ticket-secret', v_secret),
        body    := jsonb_build_object('tenant_id', NEW.tenant_id, 'ticket_id', NEW.id)
      );
      NEW.email_sent_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_ticket_received_insert
BEFORE INSERT ON public.tickets_main
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_received_insert();

-- 3. Fallback: fill placeholders on stale tickets without subject/description
CREATE OR REPLACE FUNCTION public.tickets_fill_pending_email_fallback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tickets_main
  SET subject = COALESCE(NULLIF(btrim(subject), ''), 'طلب رفع تذكرة من المحادثة'),
      description = COALESCE(NULLIF(btrim(description), ''), 'تم استلام طلب جديد من محادثة الويدجت.')
  WHERE email_sent_at IS NULL
    AND created_at < now() - interval '60 seconds'
    AND (
      subject IS NULL OR length(btrim(subject)) = 0
      OR description IS NULL OR length(btrim(description)) = 0
    );
END;
$function$;

-- Schedule fallback every minute (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('tickets-fill-pending-email-fallback')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tickets-fill-pending-email-fallback');
    PERFORM cron.schedule(
      'tickets-fill-pending-email-fallback',
      '* * * * *',
      $cron$ SELECT public.tickets_fill_pending_email_fallback(); $cron$
    );
  END IF;
END $$;