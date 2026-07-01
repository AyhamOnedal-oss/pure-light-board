-- 1) Shared key-value store for the admin pipeline board (customers, columns, members, settings).
CREATE TABLE IF NOT EXISTS public.admin_pipeline_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_pipeline_state TO authenticated;
GRANT ALL ON public.admin_pipeline_state TO service_role;

ALTER TABLE public.admin_pipeline_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_pipeline_state_read ON public.admin_pipeline_state;
CREATE POLICY admin_pipeline_state_read
  ON public.admin_pipeline_state
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'pipeline')
    OR public.admin_has_permission(auth.uid(), 'landing')
  );

DROP POLICY IF EXISTS admin_pipeline_state_write ON public.admin_pipeline_state;
CREATE POLICY admin_pipeline_state_write
  ON public.admin_pipeline_state
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'pipeline')
    OR public.admin_has_permission(auth.uid(), 'landing')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'pipeline')
    OR public.admin_has_permission(auth.uid(), 'landing')
  );

-- Realtime for immediate cross-admin sync.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_pipeline_state;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.admin_pipeline_state REPLICA IDENTITY FULL;

-- 2) Fix landing-leads RLS to use the correct permission keys.
DROP POLICY IF EXISTS admin_landing_leads_select ON public.admin_landing_leads;
DROP POLICY IF EXISTS admin_landing_leads_update ON public.admin_landing_leads;
DROP POLICY IF EXISTS admin_landing_leads_delete ON public.admin_landing_leads;

CREATE POLICY admin_landing_leads_select
  ON public.admin_landing_leads
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'landing')
    OR public.admin_has_permission(auth.uid(), 'pipeline')
  );

CREATE POLICY admin_landing_leads_update
  ON public.admin_landing_leads
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'landing')
    OR public.admin_has_permission(auth.uid(), 'pipeline')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'landing')
    OR public.admin_has_permission(auth.uid(), 'pipeline')
  );

CREATE POLICY admin_landing_leads_delete
  ON public.admin_landing_leads
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'landing')
    OR public.admin_has_permission(auth.uid(), 'pipeline')
  );