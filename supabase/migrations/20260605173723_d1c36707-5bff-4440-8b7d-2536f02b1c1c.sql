ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_tenant_phone_uniq
  ON public.team_members(tenant_id, phone) WHERE phone IS NOT NULL AND phone <> '';