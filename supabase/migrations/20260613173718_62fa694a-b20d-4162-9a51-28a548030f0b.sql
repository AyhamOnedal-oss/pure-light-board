ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS dashboard_snapshot jsonb;