
-- ============================================
-- 1. Extend profiles with phone
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- ============================================
-- 2. Extend tenants with logo + icon
-- ============================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS icon_url text;

-- ============================================
-- 3. ai_training_settings table
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_training_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'prompt' CHECK (mode IN ('prompt','file')),
  prompt text NOT NULL DEFAULT '',
  file_name text,
  file_url text,
  bubble_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY "ai_training_view"
  ON public.ai_training_settings FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "ai_training_write"
  ON public.ai_training_settings FOR ALL
  TO authenticated
  USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

CREATE TRIGGER ai_training_settings_updated_at
  BEFORE UPDATE ON public.ai_training_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 4. chat_widget_settings table
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_widget_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE,

  primary_color text NOT NULL DEFAULT '#000000',
  widget_outer_color text NOT NULL DEFAULT '#000000',
  widget_inner_color text NOT NULL DEFAULT '#FFFFFF',

  position text NOT NULL DEFAULT 'right' CHECK (position IN ('left','right')),
  preview_mode text NOT NULL DEFAULT 'light' CHECK (preview_mode IN ('light','dark')),

  welcome_bubble_enabled boolean NOT NULL DEFAULT true,
  welcome_bubble_line1 text NOT NULL DEFAULT 'مرحباً 👋',
  welcome_bubble_line2 text NOT NULL DEFAULT 'كيف يمكنني مساعدتك؟',

  inactivity_enabled boolean NOT NULL DEFAULT true,
  inactivity_prompt_seconds integer NOT NULL DEFAULT 90,
  inactivity_close_seconds integer NOT NULL DEFAULT 60,
  rating_inactivity_seconds integer NOT NULL DEFAULT 900,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY "chat_widget_view"
  ON public.chat_widget_settings FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "chat_widget_write"
  ON public.chat_widget_settings FOR ALL
  TO authenticated
  USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role))
  WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'agent'::tenant_role));

CREATE TRIGGER chat_widget_settings_updated_at
  BEFORE UPDATE ON public.chat_widget_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 5. Backfill default rows for existing tenants
-- ============================================
INSERT INTO public.ai_training_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.chat_widget_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- 6. Auto-create defaults for new tenants
-- ============================================
CREATE OR REPLACE FUNCTION public.create_tenant_default_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_training_settings (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.chat_widget_settings (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_create_default_settings ON public.tenants;
CREATE TRIGGER tenants_create_default_settings
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_tenant_default_settings();
