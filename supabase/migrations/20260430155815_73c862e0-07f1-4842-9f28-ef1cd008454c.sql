
-- =========================================================
-- 1. Drop policies that reference cross-table helpers
--    (we'll recreate them after rename)
-- =========================================================

-- Drop ALL policies on every table we are renaming
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'tenants','profiles','plan_quotas','ai_training_settings','chat_widget_settings',
        'tenant_members','user_roles',
        'conversations','messages','customers','channels',
        'tickets','ticket_activities',
        'activities','usage_daily','team_members'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Drop triggers that depend on functions we'll rewrite
DROP TRIGGER IF EXISTS tenants_create_default_settings ON public.tenants;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS ai_training_settings_updated_at ON public.ai_training_settings;
DROP TRIGGER IF EXISTS chat_widget_settings_updated_at ON public.chat_widget_settings;

-- =========================================================
-- 2. Rename tables
-- =========================================================
ALTER TABLE public.tenants                RENAME TO settings_workspace;
ALTER TABLE public.profiles               RENAME TO settings_account;
ALTER TABLE public.plan_quotas            RENAME TO settings_plans;
ALTER TABLE public.ai_training_settings   RENAME TO settings_train_ai;
ALTER TABLE public.chat_widget_settings   RENAME TO settings_chat_design;

ALTER TABLE public.tenant_members         RENAME TO auth_tenant_members;
ALTER TABLE public.user_roles             RENAME TO auth_user_roles;

ALTER TABLE public.conversations          RENAME TO conversations_main;
ALTER TABLE public.messages               RENAME TO conversations_messages;
ALTER TABLE public.customers              RENAME TO conversations_customers;
ALTER TABLE public.channels               RENAME TO conversations_channels;

ALTER TABLE public.tickets                RENAME TO tickets_main;
ALTER TABLE public.ticket_activities      RENAME TO tickets_activities;

ALTER TABLE public.activities             RENAME TO dashboard_activities;
ALTER TABLE public.usage_daily            RENAME TO dashboard_usage_daily;

-- =========================================================
-- 3. Recreate helper functions pointing at new table names
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auth_tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_role_at_least(_tenant_id uuid, _user_id uuid, _min tenant_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auth_tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id
      AND CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END >=
          CASE _min WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.auth_user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- =========================================================
-- 4. Rewrite handle_new_user() with new table names
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.settings_account (user_id, display_name, locale)
  VALUES (NEW.id, display_name, 'ar')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.settings_workspace (name, platform, status, locale)
  VALUES (display_name || '''s Workspace', 'manual', 'trial', 'ar')
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.auth_tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');

  INSERT INTO public.settings_plans (tenant_id) VALUES (new_tenant_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_tenant_default_settings()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.settings_train_ai (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.settings_chat_design (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tenants_create_default_settings
  AFTER INSERT ON public.settings_workspace
  FOR EACH ROW EXECUTE FUNCTION public.create_tenant_default_settings();

-- Updated_at triggers for renamed settings tables
CREATE TRIGGER settings_train_ai_updated_at
  BEFORE UPDATE ON public.settings_train_ai
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER settings_chat_design_updated_at
  BEFORE UPDATE ON public.settings_chat_design
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5. Recreate ALL policies with new table names
-- =========================================================

-- settings_workspace (was tenants)
CREATE POLICY "tenants_view_members" ON public.settings_workspace FOR SELECT TO authenticated
  USING (is_tenant_member(id, auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "tenants_insert_authn" ON public.settings_workspace FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tenants_update_admin" ON public.settings_workspace FOR UPDATE TO authenticated
  USING (tenant_role_at_least(id, auth.uid(), 'admin'::tenant_role));
CREATE POLICY "tenants_delete_owner" ON public.settings_workspace FOR DELETE TO authenticated
  USING (tenant_role_at_least(id, auth.uid(), 'owner'::tenant_role));

-- settings_account (was profiles)
CREATE POLICY "profiles_view_authenticated" ON public.settings_account FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.settings_account FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_self" ON public.settings_account FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- settings_plans (was plan_quotas)
CREATE POLICY "quotas_view" ON public.settings_plans FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "quotas_write" ON public.settings_plans FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role));

-- settings_train_ai
CREATE POLICY "ai_training_view" ON public.settings_train_ai FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "ai_training_write" ON public.settings_train_ai FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- settings_chat_design
CREATE POLICY "chat_widget_view" ON public.settings_chat_design FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "chat_widget_write" ON public.settings_chat_design FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- team_members (kept name)
CREATE POLICY "team_members_view" ON public.team_members FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "team_members_write" ON public.team_members FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role));

-- auth_tenant_members (was tenant_members)
CREATE POLICY "tm_view_same_tenant" ON public.auth_tenant_members FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()) OR (user_id = auth.uid()));
CREATE POLICY "tm_insert_owner" ON public.auth_tenant_members FOR INSERT TO authenticated
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'owner'::tenant_role)
              OR (NOT EXISTS (SELECT 1 FROM auth_tenant_members tm WHERE tm.tenant_id = auth_tenant_members.tenant_id)));
CREATE POLICY "tm_update_owner" ON public.auth_tenant_members FOR UPDATE TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'owner'::tenant_role));
CREATE POLICY "tm_delete_owner" ON public.auth_tenant_members FOR DELETE TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'owner'::tenant_role) OR (user_id = auth.uid()));

-- auth_user_roles (was user_roles)
CREATE POLICY "user_roles_view_self" ON public.auth_user_roles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "user_roles_admin_all" ON public.auth_user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- conversations_main (was conversations)
CREATE POLICY "conv_view" ON public.conversations_main FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "conv_write" ON public.conversations_main FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- conversations_messages (was messages)
CREATE POLICY "msg_view" ON public.conversations_messages FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "msg_write" ON public.conversations_messages FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- conversations_customers (was customers)
CREATE POLICY "customers_view" ON public.conversations_customers FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "customers_write" ON public.conversations_customers FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- conversations_channels (was channels)
CREATE POLICY "channels_view" ON public.conversations_channels FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "channels_write" ON public.conversations_channels FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role));

-- tickets_main (was tickets)
CREATE POLICY "tickets_view" ON public.tickets_main FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tickets_write" ON public.tickets_main FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- tickets_activities (was ticket_activities)
CREATE POLICY "ticket_activities_view" ON public.tickets_activities FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "ticket_activities_write" ON public.tickets_activities FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- dashboard_activities (was activities)
CREATE POLICY "activities_view" ON public.dashboard_activities FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "activities_write" ON public.dashboard_activities FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

-- dashboard_usage_daily (was usage_daily)
CREATE POLICY "usage_view" ON public.dashboard_usage_daily FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "usage_write_admin" ON public.dashboard_usage_daily FOR ALL TO authenticated
  USING (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role))
  WITH CHECK (tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role));
