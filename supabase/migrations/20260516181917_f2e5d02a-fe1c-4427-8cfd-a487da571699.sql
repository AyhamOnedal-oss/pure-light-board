
-- 1. Drop overly-permissive anon policies
DROP POLICY IF EXISTS "customers_anon_select_self" ON public.conversations_customers;
DROP POLICY IF EXISTS "msg_anon_select_history" ON public.conversations_messages;
DROP POLICY IF EXISTS "conv_anon_select_widget" ON public.conversations_main;
DROP POLICY IF EXISTS "conv_anon_update_rating" ON public.conversations_main;
DROP POLICY IF EXISTS "tickets_anon_select_widget" ON public.tickets_main;

-- 2. Tighten settings_account: only self + same-tenant teammates can view
DROP POLICY IF EXISTS "profiles_view_authenticated" ON public.settings_account;

CREATE POLICY "profiles_view_self"
ON public.settings_account
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "profiles_view_tenant_members"
ON public.settings_account
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.auth_tenant_members me
    JOIN public.auth_tenant_members them
      ON them.tenant_id = me.tenant_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = settings_account.user_id
  )
);

-- 3. Lock down realtime: only allow tenant members to subscribe to their tenant's dashboard channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_dashboard_realtime" ON realtime.messages;

CREATE POLICY "tenant_members_dashboard_realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.auth_tenant_members m
    WHERE m.user_id = auth.uid()
      AND realtime.topic() = 'dashboard-' || m.tenant_id::text
  )
);
