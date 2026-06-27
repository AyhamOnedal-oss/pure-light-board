CREATE POLICY "admins read all usage"
  ON public.dashboard_usage_daily FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins read all conversations"
  ON public.conversations_main FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role));