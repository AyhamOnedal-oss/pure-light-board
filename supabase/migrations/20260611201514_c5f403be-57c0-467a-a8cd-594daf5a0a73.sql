-- Align RLS write policies on tenant tables with the per-employee permission
-- toggles stored in public.team_members.permissions. Previously these
-- policies required tenant_role_at_least('agent'/'admin'), so invited
-- employees (created as 'viewer' by the invite-employee function) were
-- blocked from closing tickets, adding notes, editing the prompt, editing
-- the bubble design, etc., regardless of the toggles in the Team page.

-- Helper already exists: public.member_can(_tenant, _user, _key) returns
-- true when the user is owner/admin OR super_admin OR has the permission
-- key flipped on in team_members.permissions.

-- conversations_main: needs 'conversations'
DROP POLICY IF EXISTS "conv_write" ON public.conversations_main;
CREATE POLICY "conv_write" ON public.conversations_main FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'conversations'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- conversations_messages: needs 'conversations'
DROP POLICY IF EXISTS "msg_write" ON public.conversations_messages;
CREATE POLICY "msg_write" ON public.conversations_messages FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'conversations'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- conversations_customers: needs 'conversations'
DROP POLICY IF EXISTS "customers_write" ON public.conversations_customers;
CREATE POLICY "customers_write" ON public.conversations_customers FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'conversations'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- tickets_main: needs 'tickets'
DROP POLICY IF EXISTS "tickets_write" ON public.tickets_main;
CREATE POLICY "tickets_write" ON public.tickets_main FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'tickets'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'tickets'));

-- tickets_activities: needs 'tickets' (notes, status changes)
DROP POLICY IF EXISTS "ticket_activities_write" ON public.tickets_activities;
CREATE POLICY "ticket_activities_write" ON public.tickets_activities FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'tickets'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'tickets'));

-- settings_train_ai: needs 'settings_train_ai'
DROP POLICY IF EXISTS "ai_training_write" ON public.settings_train_ai;
CREATE POLICY "ai_training_write" ON public.settings_train_ai FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'settings_train_ai'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'settings_train_ai'));

-- settings_chat_design: needs 'settings_chat_design'
DROP POLICY IF EXISTS "chat_widget_write" ON public.settings_chat_design;
CREATE POLICY "chat_widget_write" ON public.settings_chat_design FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'settings_chat_design'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'settings_chat_design'));

-- settings_plans: needs 'settings_plans'
DROP POLICY IF EXISTS "quotas_write" ON public.settings_plans;
CREATE POLICY "quotas_write" ON public.settings_plans FOR ALL TO authenticated
  USING (public.member_can(tenant_id, auth.uid(), 'settings_plans'))
  WITH CHECK (public.member_can(tenant_id, auth.uid(), 'settings_plans'));

-- team_members: keep admin/owner-only (managing teammates is privileged)
-- (left unchanged on purpose)

-- conversations_channels: channels are a setup concern; keep admin-only
-- (left unchanged on purpose)
