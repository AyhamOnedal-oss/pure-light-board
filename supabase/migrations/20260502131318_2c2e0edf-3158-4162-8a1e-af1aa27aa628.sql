-- =========================================================================
-- Admin pages backend: Team, Ad Automation, Customers, Reports, Invoices
-- Read-side tables seeded with current mock data, restricted to super_admin
-- =========================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.admin_team_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_platform_id AS ENUM ('tiktok','snapchat','instagram','facebook','google');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_campaign_status AS ENUM ('active','paused','done','draft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_campaign_type AS ENUM ('image','video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_invoice_status AS ENUM ('active','inactive','expired','cancelled','paid','unpaid','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ADMIN TEAM ----------
CREATE TABLE IF NOT EXISTS public.admin_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text NOT NULL,
  email text NOT NULL,
  phone text,
  permissions text[] NOT NULL DEFAULT '{}',
  status public.admin_team_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_team_members_admin_all ON public.admin_team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_team_members_updated
  BEFORE UPDATE ON public.admin_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- AD AUTOMATION: PLATFORMS ----------
CREATE TABLE IF NOT EXISTS public.admin_ad_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id public.ad_platform_id NOT NULL,
  account_id text,
  account_name text,
  connected boolean NOT NULL DEFAULT true,
  last_sync timestamptz,
  added_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_ad_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_ad_platforms_admin_all ON public.admin_ad_platforms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_ad_platforms_updated
  BEFORE UPDATE ON public.admin_ad_platforms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- AD AUTOMATION: CAMPAIGNS ----------
CREATE TABLE IF NOT EXISTS public.admin_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_row_id uuid NOT NULL REFERENCES public.admin_ad_platforms(id) ON DELETE CASCADE,
  name text NOT NULL,
  owner text NOT NULL DEFAULT 'AI',
  type public.ad_campaign_type NOT NULL DEFAULT 'image',
  content text,
  link text,
  media_url text,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  spend integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  status public.ad_campaign_status NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT (CURRENT_DATE + 30),
  last_sync timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_ad_campaigns_platform ON public.admin_ad_campaigns(platform_row_id);
ALTER TABLE public.admin_ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_ad_campaigns_admin_all ON public.admin_ad_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_ad_campaigns_updated
  BEFORE UPDATE ON public.admin_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- ADMIN CUSTOMERS (mock fallback rows; real customers come from settings_workspace) ----------
CREATE TABLE IF NOT EXISTS public.admin_customers_seed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  store_name_ar text NOT NULL,
  email text NOT NULL,
  phone text,
  platform text NOT NULL,           -- 'Zid' | 'Salla'
  plan text NOT NULL,
  plan_ar text NOT NULL,
  usage_percent integer NOT NULL DEFAULT 0,
  words integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  status text NOT NULL,             -- 'active' | 'inactive' | 'cancelled'
  logo_initials text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_customers_seed ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_customers_seed_admin_all ON public.admin_customers_seed
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_customers_seed_updated
  BEFORE UPDATE ON public.admin_customers_seed
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- REPORTS: PLAN ROWS PER PLATFORM ----------
CREATE TABLE IF NOT EXISTS public.admin_reports_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,           -- 'zid' | 'salla'
  plan_key text NOT NULL,           -- 'trial'|'economy'|'basic'|'professional'|'business'
  plan_name text NOT NULL,
  plan_name_ar text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  subscribers integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, plan_key)
);
ALTER TABLE public.admin_reports_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_reports_plans_admin_all ON public.admin_reports_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_reports_plans_updated
  BEFORE UPDATE ON public.admin_reports_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- REPORTS: REVENUE BY MONTH ----------
CREATE TABLE IF NOT EXISTS public.admin_reports_revenue_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,           -- 1..12
  zid integer NOT NULL DEFAULT 0,
  salla integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
ALTER TABLE public.admin_reports_revenue_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_reports_revenue_monthly_admin_all ON public.admin_reports_revenue_monthly
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_reports_revenue_monthly_updated
  BEFORE UPDATE ON public.admin_reports_revenue_monthly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- INVOICES: SUBSCRIPTION PAYMENTS ----------
CREATE TABLE IF NOT EXISTS public.admin_invoices_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  store_name_ar text NOT NULL,
  invoice_date date NOT NULL,
  plan text NOT NULL,
  plan_ar text NOT NULL,
  amount integer NOT NULL,
  status public.admin_invoice_status NOT NULL DEFAULT 'pending',
  platform text NOT NULL,           -- 'Zid' | 'Salla'
  payment_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invoices_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_invoices_subscriptions_admin_all ON public.admin_invoices_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_invoices_subscriptions_updated
  BEFORE UPDATE ON public.admin_invoices_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- INVOICES: SERVERS ----------
CREATE TABLE IF NOT EXISTS public.admin_invoices_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name text NOT NULL,
  plan text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  amount_after_tax numeric(12,2) NOT NULL DEFAULT 0,
  start_date date,
  duration text,
  end_date date,
  renewal text NOT NULL DEFAULT 'auto',
  usage_percent integer NOT NULL DEFAULT 0,
  status public.admin_invoice_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invoices_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_invoices_servers_admin_all ON public.admin_invoices_servers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_invoices_servers_updated
  BEFORE UPDATE ON public.admin_invoices_servers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- INVOICES: OTHER ----------
CREATE TABLE IF NOT EXISTS public.admin_invoices_other (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vendor text NOT NULL,
  details text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  amount_after_tax numeric(12,2) NOT NULL DEFAULT 0,
  invoice_date date NOT NULL,
  invoice_number text NOT NULL,
  status public.admin_invoice_status NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invoices_other ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_invoices_other_admin_all ON public.admin_invoices_other
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER admin_invoices_other_updated
  BEFORE UPDATE ON public.admin_invoices_other
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- SEED current mock data (only if tables empty, so re-running is safe)
-- =========================================================================

-- Team
INSERT INTO public.admin_team_members (name, name_ar, email, phone, permissions, status)
SELECT * FROM (VALUES
  ('Ahmed Hassan','أحمد حسن','ahmed@samksa.ai','+966501111111',
    ARRAY['admin_dashboard','team_management','lists_management','customer_management','pipeline','customers','reports','reports_all','reports_zid','reports_salla','billing','billing_subscriptions','billing_servers','billing_other'],
    'active'::public.admin_team_status),
  ('Sara Mohammed','سارة محمد','sara@samksa.ai','+966502222222',
    ARRAY['lists_management','customer_management','pipeline','customers','reports','reports_all'],
    'active'::public.admin_team_status),
  ('Khalid Ali','خالد علي','khalid@samksa.ai','+966503333333',
    ARRAY['lists_management','customer_management','pipeline'],
    'inactive'::public.admin_team_status),
  ('Nora Ibrahim','نورة إبراهيم','nora@samksa.ai','+966504444444',
    ARRAY['lists_management','reports','reports_all','billing','billing_subscriptions'],
    'active'::public.admin_team_status)
) AS v(name,name_ar,email,phone,permissions,status)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_team_members);

-- Customers seed (the mockCustomers list)
INSERT INTO public.admin_customers_seed (store_name, store_name_ar, email, phone, platform, plan, plan_ar, usage_percent, words, total_words, status, logo_initials)
SELECT * FROM (VALUES
  ('Elegant Store','متجر أنيق','info@elegant.sa','+966501234567','Zid','Professional','احترافي',72,46800,65000,'active','ES'),
  ('Fashion Hub','مركز الموضة','hello@fashion.sa','+966507654321','Salla','Basic','أساسي',45,14400,32000,'active','FH'),
  ('Tech Galaxy','مجرة التقنية','support@tech.sa','+966509876543','Zid','Business','أعمال',88,105600,120000,'active','TG'),
  ('Home Decor','ديكور المنزل','info@homedecor.sa','+966502345678','Salla','Economy','اقتصادي',30,4500,15000,'active','HD'),
  ('Sweet Treats','حلويات لذيذة','order@sweet.sa','+966503456789','Zid','Professional','احترافي',0,0,65000,'inactive','ST'),
  ('Auto Parts','قطع غيار','sales@auto.sa','+966504567890','Salla','Basic','أساسي',15,4800,32000,'cancelled','AP'),
  ('Book World','عالم الكتب','contact@book.sa','+966505678901','Zid','Economy','اقتصادي',92,13800,15000,'active','BW'),
  ('Pet Care','عناية الحيوانات','info@petcare.sa','+966506789012','Salla','Business','أعمال',55,66000,120000,'active','PC')
) AS v(store_name,store_name_ar,email,phone,platform,plan,plan_ar,usage_percent,words,total_words,status,logo_initials)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_customers_seed);

-- Reports plans
INSERT INTO public.admin_reports_plans (platform,plan_key,plan_name,plan_name_ar,price,subscribers,total,display_order)
SELECT * FROM (VALUES
  ('zid','trial','Trial','تجريبي',0,120,0,1),
  ('zid','economy','Economy','اقتصادي',99,185,18315,2),
  ('zid','basic','Basic','أساسي',199,165,32835,3),
  ('zid','professional','Professional','احترافي',399,112,44688,4),
  ('zid','business','Business','أعمال',799,58,46342,5),
  ('salla','trial','Trial','تجريبي',0,95,0,1),
  ('salla','economy','Economy','اقتصادي',99,127,12573,2),
  ('salla','basic','Basic','أساسي',199,120,23880,3),
  ('salla','professional','Professional','احترافي',399,86,34314,4),
  ('salla','business','Business','أعمال',799,39,31161,5)
) AS v(platform,plan_key,plan_name,plan_name_ar,price,subscribers,total,display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_reports_plans);

-- Reports revenue monthly (2026)
INSERT INTO public.admin_reports_revenue_monthly (year,month,zid,salla)
SELECT * FROM (VALUES
  (2026,1,28000,22000),(2026,2,31000,24000),(2026,3,35000,27000),
  (2026,4,38000,29000),(2026,5,42000,32000),(2026,6,45000,35000),
  (2026,7,48000,37000),(2026,8,46000,36000),(2026,9,50000,39000),
  (2026,10,52000,41000),(2026,11,55000,43000),(2026,12,58000,45000)
) AS v(year,month,zid,salla)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_reports_revenue_monthly);

-- Invoices: subscriptions
INSERT INTO public.admin_invoices_subscriptions (store_name,store_name_ar,invoice_date,plan,plan_ar,amount,status,platform,payment_date)
SELECT * FROM (VALUES
  ('Elegant Store','متجر أنيق','2026-04-15'::date,'Professional','احترافي',399,'pending'::public.admin_invoice_status,'Zid',NULL::date),
  ('Fashion Hub','مركز الموضة','2026-04-14'::date,'Basic','أساسي',199,'paid'::public.admin_invoice_status,'Zid','2026-04-14'::date),
  ('Tech Galaxy','مجرة التقنية','2026-04-13'::date,'Business','أعمال',799,'pending'::public.admin_invoice_status,'Salla',NULL::date),
  ('Home Decor','ديكور المنزل','2026-04-12'::date,'Economy','اقتصادي',99,'paid'::public.admin_invoice_status,'Salla','2026-04-12'::date),
  ('Sweet Treats','حلويات لذيذة','2026-04-11'::date,'Professional','احترافي',399,'pending'::public.admin_invoice_status,'Zid',NULL::date),
  ('Pet Care','عناية الحيوانات','2026-04-10'::date,'Basic','أساسي',199,'pending'::public.admin_invoice_status,'Salla',NULL::date)
) AS v(store_name,store_name_ar,invoice_date,plan,plan_ar,amount,status,platform,payment_date)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_invoices_subscriptions);

-- Invoices: servers
INSERT INTO public.admin_invoices_servers (server_name,plan,amount,tax,amount_after_tax,start_date,duration,end_date,renewal,usage_percent,status)
SELECT * FROM (VALUES
  ('Supabase','Pro',25,3.75,28.75,'2026-01-01'::date,'12 months','2027-01-01'::date,'auto',72,'active'::public.admin_invoice_status),
  ('OpenAI','Pay-as-you-go',180,27,207,'2026-04-01'::date,'1 month','2026-05-01'::date,'auto',85,'active'::public.admin_invoice_status),
  ('Hostinger','Business',45,6.75,51.75,'2026-02-01'::date,'12 months','2027-02-01'::date,'manual',45,'active'::public.admin_invoice_status),
  ('Resend','Pro',20,3,23,'2026-03-01'::date,'1 month','2026-04-01'::date,'auto',38,'expired'::public.admin_invoice_status)
) AS v(server_name,plan,amount,tax,amount_after_tax,start_date,duration,end_date,renewal,usage_percent,status)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_invoices_servers);

-- Invoices: other
INSERT INTO public.admin_invoices_other (name,vendor,details,amount,tax,amount_after_tax,invoice_date,invoice_number,status)
SELECT * FROM (VALUES
  ('Design Services','Creative Agency','Dashboard UI/UX design',5000,750,5750,'2026-04-01'::date,'INV-2026-001','paid'::public.admin_invoice_status),
  ('Marketing Campaign','Digital Marketing Co','Q2 marketing campaign',3000,450,3450,'2026-04-10'::date,'INV-2026-002','unpaid'::public.admin_invoice_status),
  ('Legal Consultation','Law Firm','Terms & privacy review',2000,300,2300,'2026-03-15'::date,'INV-2026-003','paid'::public.admin_invoice_status)
) AS v(name,vendor,details,amount,tax,amount_after_tax,invoice_date,invoice_number,status)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_invoices_other);
