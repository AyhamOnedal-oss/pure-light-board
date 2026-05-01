
-- ============================================================================
-- Admin Dashboard tables (super_admin only)
-- Stores every data point shown on /admin (لوحة تحكم الادمن)
-- All tables are scoped to super_admin via has_role(auth.uid(), 'super_admin')
-- ============================================================================

-- 1) KPI cards (Total Customers, Inactive, Uninstalls, Active, Bubble Clicks, Avg Response Time)
CREATE TABLE public.admin_dash_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT (now())::date,
  -- Each column maps 1:1 to a card in the dashboard
  total_customers INTEGER NOT NULL DEFAULT 0,
  inactive_customers INTEGER NOT NULL DEFAULT 0,
  total_uninstalls INTEGER NOT NULL DEFAULT 0,
  active_customers INTEGER NOT NULL DEFAULT 0,
  total_bubble_clicks INTEGER NOT NULL DEFAULT 0,
  avg_response_seconds NUMERIC(6,2) NOT NULL DEFAULT 0,
  -- Trend deltas (percent change vs previous period) shown next to each KPI
  total_customers_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  inactive_customers_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_uninstalls_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  active_customers_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_bubble_clicks_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  avg_response_seconds_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date)
);

-- 2) Words / Tokens usage per month (bar chart, 12 months)
CREATE TABLE public.admin_dash_words_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  words INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

-- 3) New subscribers per month per platform (line chart, 12 months × Zid/Salla)
CREATE TYPE platform_kind AS ENUM ('zid', 'salla');

CREATE TABLE public.admin_dash_new_subs_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  platform platform_kind NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month, platform)
);

-- 4) Plan distribution (Current Customer Plans pie + Subscribers by Plan – Zid/Salla)
CREATE TYPE plan_tier AS ENUM ('trial', 'economy', 'basic', 'professional', 'business');

CREATE TABLE public.admin_dash_plan_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- platform = NULL means "current customer plans" (overall pie)
  -- platform = 'zid' / 'salla' means platform-specific bar chart
  platform platform_kind NULL,
  plan plan_tier NOT NULL,
  subscribers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, plan)
);

-- 5) Subscriptions by platform & status (grouped bar chart)
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled');

CREATE TABLE public.admin_dash_platform_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status subscription_status NOT NULL,
  platform platform_kind NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (status, platform)
);

-- 6) First Subscription Type (pie) - which plan customers picked first
CREATE TABLE public.admin_dash_first_sub_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan plan_tier NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Customer Source Comparison (pie - Zid vs Salla totals)
CREATE TABLE public.admin_dash_customer_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform platform_kind NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) Uninstall Comparison (bar chart - Zid vs Salla uninstalls)
CREATE TABLE public.admin_dash_uninstalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform platform_kind NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) New subscribers list (right column - "المشتركون الجدد")
CREATE TABLE public.admin_dash_new_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,        -- e.g. "Elegant Store" / "متجر أنيق"
  platform platform_kind NOT NULL, -- 'zid' or 'salla'
  subscribed_on DATE NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  used_tokens INTEGER NOT NULL DEFAULT 0,
  logo_initials TEXT NOT NULL,     -- e.g. "ES", "FH"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) Server / Service status & usage (Server Status grid + Server Usage bars)
CREATE TYPE server_connection_status AS ENUM ('connected', 'disconnected');

CREATE TABLE public.admin_dash_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                   -- "Supabase", "OpenAI", etc.
  status server_connection_status NOT NULL DEFAULT 'connected',
  usage_percent INTEGER NOT NULL DEFAULT 0 CHECK (usage_percent BETWEEN 0 AND 100),
  color TEXT NOT NULL DEFAULT '#043CC8',       -- bar color shown in usage chart
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Enable RLS + super_admin-only policies
-- ============================================================================

ALTER TABLE public.admin_dash_kpi_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_words_monthly      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_new_subs_monthly   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_plan_distribution  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_platform_subs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_first_sub_type     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_customer_source    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_uninstalls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_new_subscribers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dash_servers            ENABLE ROW LEVEL SECURITY;

-- Helper policy generator pattern (super admins can do everything)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_dash_kpi_snapshots',
    'admin_dash_words_monthly',
    'admin_dash_new_subs_monthly',
    'admin_dash_plan_distribution',
    'admin_dash_platform_subs',
    'admin_dash_first_sub_type',
    'admin_dash_customer_source',
    'admin_dash_uninstalls',
    'admin_dash_new_subscribers',
    'admin_dash_servers'
  ]
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
    $f$, tbl || '_admin_all', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_dash_kpi_snapshots',
    'admin_dash_words_monthly',
    'admin_dash_new_subs_monthly',
    'admin_dash_plan_distribution',
    'admin_dash_platform_subs',
    'admin_dash_first_sub_type',
    'admin_dash_customer_source',
    'admin_dash_uninstalls',
    'admin_dash_new_subscribers',
    'admin_dash_servers'
  ]
  LOOP
    EXECUTE format($f$
      CREATE TRIGGER set_updated_at_%I
      BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    $f$, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Seed mock data (matches what the dashboard currently shows)
-- ============================================================================

-- KPIs
INSERT INTO public.admin_dash_kpi_snapshots (
  snapshot_date,
  total_customers, inactive_customers, total_uninstalls, active_customers, total_bubble_clicks, avg_response_seconds,
  total_customers_change, inactive_customers_change, total_uninstalls_change, active_customers_change, total_bubble_clicks_change, avg_response_seconds_change
) VALUES (
  CURRENT_DATE,
  1247, 355, 89, 892, 45230, 1.2,
  12.5, 3.2, 8.1, 15.3, 22.7, 5.4
);

-- Words usage – 12 months (current year)
INSERT INTO public.admin_dash_words_monthly (year, month, words) VALUES
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  1, 165000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  2, 173000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  3, 190000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  4, 197000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  5, 208000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  6, 223000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  7, 235000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  8, 220000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  9, 252000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 271000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 11, 287000),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 308000);

-- New subscribers per month per platform – 12 months
INSERT INTO public.admin_dash_new_subs_monthly (year, month, platform, count) VALUES
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  1, 'zid',   35), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  1, 'salla', 28),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  2, 'zid',   42), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  2, 'salla', 31),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  3, 'zid',   38), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  3, 'salla', 35),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  4, 'zid',   50), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  4, 'salla', 40),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  5, 'zid',   55), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  5, 'salla', 43),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  6, 'zid',   48), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  6, 'salla', 46),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  7, 'zid',   60), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  7, 'salla', 50),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  8, 'zid',   52), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  8, 'salla', 47),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int,  9, 'zid',   65), (EXTRACT(YEAR FROM CURRENT_DATE)::int,  9, 'salla', 55),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 'zid',   70), (EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 'salla', 58),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 11, 'zid',   68), (EXTRACT(YEAR FROM CURRENT_DATE)::int, 11, 'salla', 62),
  (EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 'zid',   75), (EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 'salla', 65);

-- Current customer plans (overall pie - platform NULL)
INSERT INTO public.admin_dash_plan_distribution (platform, plan, subscribers) VALUES
  (NULL, 'economy',      312),
  (NULL, 'basic',        285),
  (NULL, 'professional', 198),
  (NULL, 'business',     97);

-- Per-platform plan distribution (Zid)
INSERT INTO public.admin_dash_plan_distribution (platform, plan, subscribers) VALUES
  ('zid', 'economy',      185),
  ('zid', 'basic',        165),
  ('zid', 'professional', 112),
  ('zid', 'business',     58);

-- Per-platform plan distribution (Salla)
INSERT INTO public.admin_dash_plan_distribution (platform, plan, subscribers) VALUES
  ('salla', 'economy',      127),
  ('salla', 'basic',        120),
  ('salla', 'professional', 86),
  ('salla', 'business',     39);

-- Subscriptions by platform & status
INSERT INTO public.admin_dash_platform_subs (status, platform, count) VALUES
  ('active',    'zid',   520), ('active',    'salla', 372),
  ('inactive',  'zid',   180), ('inactive',  'salla', 175),
  ('cancelled', 'zid',   45),  ('cancelled', 'salla', 44);

-- First Subscription Type (pie)
INSERT INTO public.admin_dash_first_sub_type (plan, count) VALUES
  ('trial',        580),
  ('economy',      210),
  ('basic',        185),
  ('professional', 165),
  ('business',     107);

-- Customer Source Comparison (pie)
INSERT INTO public.admin_dash_customer_source (platform, count) VALUES
  ('zid',   745),
  ('salla', 502);

-- Uninstall Comparison (bar)
INSERT INTO public.admin_dash_uninstalls (platform, count) VALUES
  ('zid',   42),
  ('salla', 47);

-- New Subscribers list
INSERT INTO public.admin_dash_new_subscribers (store_name, platform, subscribed_on, total_tokens, used_tokens, logo_initials) VALUES
  ('Elegant Store', 'zid',   '2026-04-15', 50000,  12000, 'ES'),
  ('Fashion Hub',   'salla', '2026-04-14', 100000, 5000,  'FH'),
  ('Tech Galaxy',   'zid',   '2026-04-13', 50000,  31000, 'TG'),
  ('Home Decor',    'salla', '2026-04-12', 200000, 89000, 'HD'),
  ('Sweet Treats',  'zid',   '2026-04-11', 50000,  2000,  'ST'),
  ('Auto Parts',    'salla', '2026-04-10', 100000, 67000, 'AP'),
  ('Book World',    'zid',   '2026-04-09', 50000,  44000, 'BW');

-- Servers (status + usage)
INSERT INTO public.admin_dash_servers (name, status, usage_percent, color, display_order) VALUES
  ('Supabase',  'connected',    72, '#22c55e', 1),
  ('Hostinger', 'connected',    45, '#043CC8', 2),
  ('Resend',    'disconnected', 38, '#a855f7', 3),
  ('OpenAI',    'connected',    85, '#ff4466', 4);
