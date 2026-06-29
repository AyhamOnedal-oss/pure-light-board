
-- ============================================================
-- Zid Reports: 3-table design + RLS + indexes + seed plan map
-- ============================================================

-- 1. Plan map (static lookup)
CREATE TABLE IF NOT EXISTS public.zid_plan_map (
  zid_plan_code   text PRIMARY KEY,
  name_en         text NOT NULL,
  name_ar         text NOT NULL,
  list_price_sar  numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle   text NOT NULL DEFAULT 'monthly',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zid_plan_map TO authenticated;
GRANT ALL    ON public.zid_plan_map TO service_role;
ALTER TABLE public.zid_plan_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read zid_plan_map"
  ON public.zid_plan_map FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_reports'));

-- 2. Subscriptions (current state, one row per tenant)
CREATE TABLE IF NOT EXISTS public.zid_subscriptions (
  tenant_id            uuid PRIMARY KEY REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  zid_store_id         text,
  zid_plan_code        text REFERENCES public.zid_plan_map(zid_plan_code),
  status               text NOT NULL DEFAULT 'trial',
  started_at           timestamptz,
  current_period_end   timestamptz,
  cancelled_at         timestamptz,
  last_synced_at       timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zid_subscriptions TO authenticated;
GRANT ALL    ON public.zid_subscriptions TO service_role;
ALTER TABLE public.zid_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read zid_subscriptions"
  ON public.zid_subscriptions FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_reports'));
CREATE INDEX IF NOT EXISTS idx_zid_subs_plan   ON public.zid_subscriptions(zid_plan_code);
CREATE INDEX IF NOT EXISTS idx_zid_subs_status ON public.zid_subscriptions(status);

-- 3. Charges (append-only ledger)
CREATE TABLE IF NOT EXISTS public.zid_charges (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.settings_workspace(id) ON DELETE CASCADE,
  zid_charge_id         text NOT NULL UNIQUE,
  zid_plan_code         text REFERENCES public.zid_plan_map(zid_plan_code),
  charged_at            timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'paid',
  gross_amount_sar      numeric(12,2) NOT NULL DEFAULT 0,
  vat_sar               numeric(12,2) NOT NULL DEFAULT 0,
  zid_commission_sar    numeric(12,2) NOT NULL DEFAULT 0,
  developer_net_sar     numeric(12,2) NOT NULL DEFAULT 0,
  payout_month          date,
  is_below_minimum      boolean NOT NULL DEFAULT false,
  raw                   jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zid_charges TO authenticated;
GRANT ALL    ON public.zid_charges TO service_role;
ALTER TABLE public.zid_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read zid_charges"
  ON public.zid_charges FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_reports'));
CREATE INDEX IF NOT EXISTS idx_zid_charges_tenant_time ON public.zid_charges(tenant_id, charged_at);
CREATE INDEX IF NOT EXISTS idx_zid_charges_status_time ON public.zid_charges(status, charged_at);
CREATE INDEX IF NOT EXISTS idx_zid_charges_payout      ON public.zid_charges(payout_month);

-- updated_at triggers
CREATE TRIGGER zid_plan_map_set_updated_at
  BEFORE UPDATE ON public.zid_plan_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER zid_subscriptions_set_updated_at
  BEFORE UPDATE ON public.zid_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER zid_charges_set_updated_at
  BEFORE UPDATE ON public.zid_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed plans (idempotent)
INSERT INTO public.zid_plan_map (zid_plan_code, name_en, name_ar, list_price_sar, billing_cycle) VALUES
  ('trial',        'Trial',        'تجريبي',  0,   'monthly'),
  ('economy',      'Economy',      'اقتصادي', 99,  'monthly'),
  ('basic',        'Basic',        'أساسي',   199, 'monthly'),
  ('professional', 'Professional', 'احترافي', 399, 'monthly'),
  ('business',     'Business',     'أعمال',   799, 'monthly')
ON CONFLICT (zid_plan_code) DO NOTHING;
