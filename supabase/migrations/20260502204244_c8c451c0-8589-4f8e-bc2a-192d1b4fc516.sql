-- Enable extensions needed for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Backfill the existing Salla connection that was saved with a wrong (year 2082) expiry.
-- Salla access tokens last 14 days; reset based on connected_at.
UPDATE public.salla_connections
SET token_expires_at = connected_at + INTERVAL '14 days'
WHERE token_expires_at > (now() + INTERVAL '1 year');

-- Schedule the daily token refresh job (runs every day at 03:00 UTC).
-- Calls the salla-token-refresh edge function which refreshes any token
-- expiring in the next 48 hours.
SELECT cron.schedule(
  'salla-token-refresh-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://kdrcgusinkqgwaafcgnw.supabase.co/functions/v1/salla-token-refresh',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcmNndXNpbmtxZ3dhYWZjZ253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDg1NzEsImV4cCI6MjA5Mjg4NDU3MX0.90d40LUVe1yqZMtHlDCq6RDlSLYpyrdrTb-On4zsfg0"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);