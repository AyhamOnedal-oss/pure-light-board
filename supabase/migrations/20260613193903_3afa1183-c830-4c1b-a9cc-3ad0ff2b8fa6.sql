ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS team_members_tenant_deleted_at_idx
  ON public.team_members (tenant_id, deleted_at);

CREATE OR REPLACE FUNCTION public.is_email_deleted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE lower(email) = lower(_email)
      AND deleted_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_deleted(text) TO anon, authenticated;
