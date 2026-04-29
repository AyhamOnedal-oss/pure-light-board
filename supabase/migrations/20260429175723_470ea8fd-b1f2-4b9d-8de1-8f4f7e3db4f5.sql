-- Status enum
CREATE TYPE public.team_member_status AS ENUM ('active', 'inactive');

-- Team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status public.team_member_status NOT NULL DEFAULT 'active',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_team_members_tenant ON public.team_members(tenant_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_view"
  ON public.team_members FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "team_members_write"
  ON public.team_members FOR ALL TO authenticated
  USING (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role))
  WITH CHECK (public.tenant_role_at_least(tenant_id, auth.uid(), 'admin'::tenant_role));

CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed sample members for both demo workspaces
INSERT INTO public.team_members (tenant_id, name, email, phone, status, permissions)
SELECT t.tenant_id, m.name, m.email, m.phone, m.status::public.team_member_status, m.permissions::jsonb
FROM (VALUES
  ('485d1819-77c7-4275-a445-9e4326a084ae'::uuid),
  ('00fa2c6b-3d32-48e1-b3ab-f285fa93e1ee'::uuid)
) AS t(tenant_id)
CROSS JOIN (VALUES
  ('Sara Al-Rashid',  'sara@store.com',   '551234567', 'active',   '{"home":true,"conversations":true,"tickets":true}'),
  ('Omar Khalid',     'omar@store.com',   '509876543', 'active',   '{"home":true,"team":true,"conversations":true,"tickets":true}'),
  ('Layla Ahmed',     'layla@store.com',  '544567890', 'inactive', '{"home":true,"conversations":true}'),
  ('Khalid Nasser',   'khalid@store.com', '563210987', 'active',   '{"home":true,"tickets":true}'),
  ('Nora Saeed',      'nora@store.com',   '596543210', 'active',   '{"home":true,"conversations":true,"tickets":true,"settings":true,"settings_test_chat":true}')
) AS m(name, email, phone, status, permissions);