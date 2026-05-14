
-- Attach trigger to fire AI classification when a conversation is resolved/closed
DROP TRIGGER IF EXISTS trg_notify_classify_conversation ON public.conversations_main;

CREATE TRIGGER trg_notify_classify_conversation
AFTER UPDATE OF status ON public.conversations_main
FOR EACH ROW
EXECUTE FUNCTION public.notify_classify_conversation();

-- Also fire for 'closed' status, not only 'resolved'
CREATE OR REPLACE FUNCTION public.notify_classify_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('resolved','closed')
     AND COALESCE(NEW.analysis_done, false) = false THEN
    SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'classify_webhook_secret';
    SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'classify_webhook_url';
    IF v_secret IS NOT NULL AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-classify-secret', v_secret
        ),
        body    := jsonb_build_object(
          'tenant_id', NEW.tenant_id,
          'conversation_id', NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: trigger classification for existing resolved/closed conversations that haven't been analyzed
DO $$
DECLARE
  r record;
  v_secret text;
  v_url text;
BEGIN
  SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'classify_webhook_secret';
  SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'classify_webhook_url';
  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE NOTICE 'Classify webhook secrets missing — skipping backfill';
    RETURN;
  END IF;
  FOR r IN
    SELECT id, tenant_id FROM public.conversations_main
    WHERE status IN ('resolved','closed') AND COALESCE(analysis_done, false) = false
    LIMIT 200
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-classify-secret', v_secret),
      body := jsonb_build_object('tenant_id', r.tenant_id, 'conversation_id', r.id)
    );
  END LOOP;
END $$;
