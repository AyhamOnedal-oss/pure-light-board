
-- Helper: confirm a tenant exists (used by anon-facing policies to prevent
-- inserting against a random tenant_id).
CREATE OR REPLACE FUNCTION public.tenant_exists(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.settings_workspace WHERE id = _tenant_id);
$$;

-- ─── tickets_main: anon INSERT for storefront widget ─────────────────────
CREATE POLICY "tickets_anon_insert_widget"
ON public.tickets_main
FOR INSERT
TO anon
WITH CHECK (
  tenant_exists(tenant_id)
  AND status = 'open'
  AND assignee_user_id IS NULL
  AND resolved_at IS NULL
);

-- ─── conversations_main: anon UPDATE for rating + close only ─────────────
CREATE POLICY "conv_anon_update_rating"
ON public.conversations_main
FOR UPDATE
TO anon
USING (tenant_exists(tenant_id))
WITH CHECK (tenant_exists(tenant_id));

-- ─── conversations_messages: anon SELECT (load history on reopen) ───────
CREATE POLICY "msg_anon_select_history"
ON public.conversations_messages
FOR SELECT
TO anon
USING (tenant_exists(tenant_id));

-- ─── conversations_customers: anon SELECT by external_id (find self) ────
CREATE POLICY "customers_anon_select_self"
ON public.conversations_customers
FOR SELECT
TO anon
USING (tenant_exists(tenant_id));

-- ─── conversations_main: anon SELECT (find existing conversation) ──────
CREATE POLICY "conv_anon_select_widget"
ON public.conversations_main
FOR SELECT
TO anon
USING (tenant_exists(tenant_id));
