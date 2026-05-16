CREATE POLICY tickets_anon_select_widget
  ON public.tickets_main
  FOR SELECT
  TO anon
  USING (tenant_exists(tenant_id));