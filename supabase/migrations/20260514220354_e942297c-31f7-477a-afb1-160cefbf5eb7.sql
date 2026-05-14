
-- 1. Null out canonical visitor placeholders so the UI fallback fires
UPDATE public.conversations_customers
SET display_name = NULL
WHERE lower(coalesce(display_name,'')) IN
  ('storefront visitor','store visitor','visitor','visitor customer','anonymous','guest');

-- 2. Reset analysis fields and re-dispatch classification for closed/resolved chats
DO $$
DECLARE
  r record;
  v_secret text;
  v_url text;
BEGIN
  SELECT value INTO v_secret FROM public._app_secrets WHERE key = 'classify_webhook_secret';
  SELECT value INTO v_url    FROM public._app_secrets WHERE key = 'classify_webhook_url';
  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE NOTICE 'Classify webhook secrets missing — skipping re-dispatch';
    RETURN;
  END IF;

  UPDATE public.conversations_main
  SET analysis_done = false,
      completion_score = NULL,
      intent_type = NULL,
      goal_met = NULL
  WHERE status IN ('resolved','closed');

  FOR r IN
    SELECT id, tenant_id FROM public.conversations_main
    WHERE status IN ('resolved','closed')
    LIMIT 500
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-classify-secret', v_secret),
      body := jsonb_build_object('tenant_id', r.tenant_id, 'conversation_id', r.id)
    );
  END LOOP;
END $$;
