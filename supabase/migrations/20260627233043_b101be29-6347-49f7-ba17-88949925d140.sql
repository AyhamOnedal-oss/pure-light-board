CREATE TABLE IF NOT EXISTS public.admin_credit_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  words integer NOT NULL,
  added_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_credit_topups TO authenticated;
GRANT ALL ON public.admin_credit_topups TO service_role;
ALTER TABLE public.admin_credit_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read topups" ON public.admin_credit_topups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admins insert topups" ON public.admin_credit_topups FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS admin_credit_topups_tenant_idx ON public.admin_credit_topups(tenant_id, created_at DESC);