-- ============================================
-- Phase 1: OAuth + Widget Database Foundation
-- ============================================

-- ============================================
-- salla_connections
-- ============================================
CREATE TABLE public.salla_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  merchant_id bigint NOT NULL,
  store_id text,
  store_name text,
  store_url text,
  store_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  connection_status text NOT NULL DEFAULT 'pending_oauth',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX salla_connections_merchant_id_key ON public.salla_connections (merchant_id);
CREATE INDEX salla_connections_tenant_id_idx ON public.salla_connections (tenant_id);

ALTER TABLE public.salla_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salla_connections_tenant_view"
  ON public.salla_connections FOR SELECT
  USING (
    tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "salla_connections_admin_write"
  ON public.salla_connections FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER salla_connections_set_updated_at
  BEFORE UPDATE ON public.salla_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- zid_connections
-- ============================================
CREATE TABLE public.zid_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  store_uuid text NOT NULL,
  store_name text,
  store_url text,
  store_email text,
  authorization_token text,
  manager_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  connection_status text NOT NULL DEFAULT 'pending_oauth',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX zid_connections_store_uuid_key ON public.zid_connections (store_uuid);
CREATE INDEX zid_connections_tenant_id_idx ON public.zid_connections (tenant_id);

ALTER TABLE public.zid_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zid_connections_tenant_view"
  ON public.zid_connections FOR SELECT
  USING (
    tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "zid_connections_admin_write"
  ON public.zid_connections FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER zid_connections_set_updated_at
  BEFORE UPDATE ON public.zid_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- salla_events (audit log)
-- ============================================
CREATE TABLE public.salla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id bigint,
  tenant_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX salla_events_merchant_id_idx ON public.salla_events (merchant_id);
CREATE INDEX salla_events_event_type_idx ON public.salla_events (event_type);
CREATE INDEX salla_events_created_at_idx ON public.salla_events (created_at DESC);

ALTER TABLE public.salla_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salla_events_admin_view"
  ON public.salla_events FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- zid_events (audit log)
-- ============================================
CREATE TABLE public.zid_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_uuid text,
  tenant_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX zid_events_store_uuid_idx ON public.zid_events (store_uuid);
CREATE INDEX zid_events_event_type_idx ON public.zid_events (event_type);
CREATE INDEX zid_events_created_at_idx ON public.zid_events (created_at DESC);

ALTER TABLE public.zid_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zid_events_admin_view"
  ON public.zid_events FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- pending_salla_connections (claim helper)
-- ============================================
CREATE TABLE public.pending_salla_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX pending_salla_user_id_idx ON public.pending_salla_connections (user_id);

ALTER TABLE public.pending_salla_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_salla_view_self"
  ON public.pending_salla_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "pending_salla_insert_self"
  ON public.pending_salla_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pending_salla_delete_self"
  ON public.pending_salla_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Extend settings_workspace
-- ============================================
ALTER TABLE public.settings_workspace
  ADD COLUMN IF NOT EXISTS salla_merchant_id bigint,
  ADD COLUMN IF NOT EXISTS zid_store_uuid text;

CREATE INDEX IF NOT EXISTS settings_workspace_salla_merchant_id_idx
  ON public.settings_workspace (salla_merchant_id) WHERE salla_merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS settings_workspace_zid_store_uuid_idx
  ON public.settings_workspace (zid_store_uuid) WHERE zid_store_uuid IS NOT NULL;

-- ============================================
-- Extend settings_chat_design
-- ============================================
ALTER TABLE public.settings_chat_design
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS bubble_offset_x integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bubble_offset_y integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bubble_size integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS welcome_message text NOT NULL DEFAULT 'مرحباً 👋 كيف يمكنني مساعدتك؟',
  ADD COLUMN IF NOT EXISTS input_placeholder text NOT NULL DEFAULT 'اكتب رسالتك...',
  ADD COLUMN IF NOT EXISTS auto_open_delay integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_branding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tickets_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ratings_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS export_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS copy_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_feedback_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_countries text[] NOT NULL DEFAULT '{}'::text[];