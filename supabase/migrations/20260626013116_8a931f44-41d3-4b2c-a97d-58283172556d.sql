
-- Let any signed-in admin staff read THEIR OWN admin_team_members row
-- so the frontend can load the permissions super-admin assigned to them.
DROP POLICY IF EXISTS admin_team_members_self_read ON public.admin_team_members;
CREATE POLICY admin_team_members_self_read ON public.admin_team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
