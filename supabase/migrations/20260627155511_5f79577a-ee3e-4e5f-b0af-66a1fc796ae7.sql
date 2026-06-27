
CREATE POLICY "admin_staff_view_all_tm" ON public.auth_tenant_members
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_staff_view_all_ws" ON public.settings_workspace
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_staff_view_all_zid" ON public.zid_connections
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_staff_view_all_salla" ON public.salla_connections
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_staff_view_all_plans" ON public.settings_plans
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
