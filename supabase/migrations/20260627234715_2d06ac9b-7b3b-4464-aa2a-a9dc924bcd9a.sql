CREATE POLICY "admins read all classifier usage"
ON public.ai_classifier_usage FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));