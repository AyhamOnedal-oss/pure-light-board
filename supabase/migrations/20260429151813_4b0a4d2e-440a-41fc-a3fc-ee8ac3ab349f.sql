-- =========================================================================
-- 0. Cleanup existing demo activities (will be rescoped to tenant_id)
-- =========================================================================
DROP TABLE IF EXISTS public.activities CASCADE;

-- =========================================================================
-- 1. Enums (idempotent)
-- =========================================================================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('super_admin', 'support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'agent', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tenant_platform AS ENUM ('salla', 'zid', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.channel_kind AS ENUM ('whatsapp', 'instagram', 'tiktok', 'snapchat', 'web', 'salla', 'zid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.channel_status AS ENUM ('connected', 'disconnected', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_status AS ENUM ('new', 'open', 'pending', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_category AS ENUM ('shipping', 'refund', 'product', 'payment', 'complaint', 'inquiry', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_sender AS ENUM ('customer', 'agent', 'ai', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM ('conversation', 'ticket', 'insight'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_channel AS ENUM ('whatsapp', 'instagram', 'tiktok', 'snapchat', 'web', 'none'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_status AS ENUM ('open', 'pending', 'resolved', 'trending', 'new'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 2. Profiles
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 3. Tenants
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform public.tenant_platform NOT NULL DEFAULT 'manual',
  external_store_id TEXT,
  domain TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status public.tenant_status NOT NULL DEFAULT 'trial',
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_store_id)
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 4. Tenant members
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_tenant_members_updated_at ON public.tenant_members;
CREATE TRIGGER trg_tenant_members_updated_at BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 5. user_roles (platform-wide)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 6. Helper functions
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.tenant_role_at_least(_tenant_id UUID, _user_id UUID, _min public.tenant_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id
      AND CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END >=
          CASE _min WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tenant_role_at_least(UUID, UUID, public.tenant_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_role_at_least(UUID, UUID, public.tenant_role) TO authenticated;

-- =========================================================================
-- 7. Channels
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind public.channel_kind NOT NULL,
  display_name TEXT,
  status public.channel_status NOT NULL DEFAULT 'disconnected',
  external_account_id TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, external_account_id)
);
CREATE INDEX IF NOT EXISTS idx_channels_tenant ON public.channels(tenant_id);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_channels_updated_at ON public.channels;
CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 8. Customers
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name TEXT,
  display_name_ar TEXT,
  phone TEXT,
  email TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  external_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(tenant_id, phone);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 9. Conversations
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  channel_kind public.channel_kind NOT NULL DEFAULT 'web',
  status public.conversation_status NOT NULL DEFAULT 'new',
  category public.conversation_category,
  subject TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  csat_rating SMALLINT CHECK (csat_rating BETWEEN 1 AND 5),
  csat_comment TEXT,
  ai_quality_score SMALLINT CHECK (ai_quality_score BETWEEN 0 AND 100),
  ai_handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_lastmsg ON public.conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status ON public.conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON public.conversations(assignee_user_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 10. Messages
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender public.message_sender NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  ai_tokens_in INTEGER NOT NULL DEFAULT 0,
  ai_tokens_out INTEGER NOT NULL DEFAULT 0,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON public.messages(tenant_id, created_at DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 11. Tickets
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  number SERIAL NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  category public.conversation_category,
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON public.tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON public.tickets(assignee_user_id);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 12. Activities (rescoped)
-- =========================================================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  channel public.activity_channel NOT NULL DEFAULT 'none',
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  primary_en TEXT NOT NULL,
  primary_ar TEXT NOT NULL,
  preview_en TEXT NOT NULL DEFAULT '',
  preview_ar TEXT NOT NULL DEFAULT '',
  status public.activity_status NOT NULL DEFAULT 'new',
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_tenant_updated ON public.activities(tenant_id, updated_at DESC);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 13. Usage daily
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  messages_in INTEGER NOT NULL DEFAULT 0,
  messages_out INTEGER NOT NULL DEFAULT 0,
  ai_words_used INTEGER NOT NULL DEFAULT 0,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  unique_customers INTEGER NOT NULL DEFAULT 0,
  conversations_opened INTEGER NOT NULL DEFAULT 0,
  conversations_resolved INTEGER NOT NULL DEFAULT 0,
  avg_response_seconds INTEGER NOT NULL DEFAULT 0,
  csat_avg NUMERIC(3,2),
  ai_quality_avg NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, day)
);
CREATE INDEX IF NOT EXISTS idx_usage_daily_tenant_day ON public.usage_daily(tenant_id, day DESC);
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_usage_daily_updated_at ON public.usage_daily;
CREATE TRIGGER trg_usage_daily_updated_at BEFORE UPDATE ON public.usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 14. Plan quotas
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.plan_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  monthly_word_quota INTEGER NOT NULL DEFAULT 100000,
  seat_quota INTEGER NOT NULL DEFAULT 3,
  channel_quota INTEGER NOT NULL DEFAULT 3,
  monthly_words_used INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_plan_quotas_updated_at ON public.plan_quotas;
CREATE TRIGGER trg_plan_quotas_updated_at BEFORE UPDATE ON public.plan_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 15. RLS POLICIES
-- =========================================================================
CREATE POLICY "profiles_view_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self"       ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_self"       ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_roles_view_self" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tenants_view_members" ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenants_insert_authn" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tenants_update_admin" ON public.tenants FOR UPDATE TO authenticated USING (public.tenant_role_at_least(id, auth.uid(), 'admin'));
CREATE POLICY "tenants_delete_owner" ON public.tenants FOR DELETE TO authenticated USING (public.tenant_role_at_least(id, auth.uid(), 'owner'));

CREATE POLICY "tm_view_same_tenant" ON public.tenant_members FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "tm_insert_owner"     ON public.tenant_members FOR INSERT TO authenticated WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'owner') OR NOT EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = tenant_members.tenant_id));
CREATE POLICY "tm_update_owner"     ON public.tenant_members FOR UPDATE TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'owner'));
CREATE POLICY "tm_delete_owner"     ON public.tenant_members FOR DELETE TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'owner') OR user_id = auth.uid());

CREATE POLICY "channels_view"  ON public.channels FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "channels_write" ON public.channels FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin'));

CREATE POLICY "customers_view"  ON public.customers FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "customers_write" ON public.customers FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'));

CREATE POLICY "conv_view"  ON public.conversations FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "conv_write" ON public.conversations FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'));

CREATE POLICY "msg_view"  ON public.messages FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "msg_write" ON public.messages FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'));

CREATE POLICY "tickets_view"  ON public.tickets FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tickets_write" ON public.tickets FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'));

CREATE POLICY "activities_view"  ON public.activities FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "activities_write" ON public.activities FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'));

CREATE POLICY "usage_view"        ON public.usage_daily FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "usage_write_admin" ON public.usage_daily FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin'));

CREATE POLICY "quotas_view"  ON public.plan_quotas FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "quotas_write" ON public.plan_quotas FOR ALL    TO authenticated USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin')) WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin'));

-- =========================================================================
-- 16. Auto-provision profile + tenant on signup
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_tenant_id UUID;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (user_id, display_name, locale)
  VALUES (NEW.id, display_name, 'ar')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.tenants (name, platform, status, locale)
  VALUES (display_name || '''s Workspace', 'manual', 'trial', 'ar')
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');

  INSERT INTO public.plan_quotas (tenant_id) VALUES (new_tenant_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;