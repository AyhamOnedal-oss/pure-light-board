ALTER TABLE public.zid_connections
  ADD COLUMN IF NOT EXISTS theme_script_id text,
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz;