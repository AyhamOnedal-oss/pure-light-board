
-- Unschedule the hourly Zid sync cron job (if it exists)
DO $$
BEGIN
  PERFORM cron.unschedule('zid-sync-subscriptions-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TABLE IF EXISTS public.zid_charges CASCADE;
DROP TABLE IF EXISTS public.zid_subscriptions CASCADE;
DROP TABLE IF EXISTS public.zid_plan_map CASCADE;
