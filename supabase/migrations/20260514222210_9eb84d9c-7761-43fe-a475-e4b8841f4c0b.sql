DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-close-idle-conversations') THEN
      PERFORM cron.unschedule('auto-close-idle-conversations');
    END IF;
  END IF;
END $$;

UPDATE conversations_main
SET status='closed', close_reason='idle', resolved_at=now(), updated_at=now()
WHERE id::text LIKE 'ea5a3f5c%' AND status IN ('new','open','pending');