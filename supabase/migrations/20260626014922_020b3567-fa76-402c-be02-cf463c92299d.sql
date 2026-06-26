
CREATE TABLE IF NOT EXISTS public.admin_landing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  customer_type text NOT NULL CHECK (customer_type IN ('new','existing')),
  contact_time text NOT NULL CHECK (contact_time IN ('morning','evening')),
  source text CHECK (source IN ('tiktok','instagram','snapchat','facebook','google','ecommerce','other')),
  subject text,
  match_status text NOT NULL DEFAULT 'none' CHECK (match_status IN ('full','partial','none')),
  matched_tenant_id uuid,
  copied_to_pipeline_at timestamptz,
  pipeline_customer_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.admin_landing_leads TO authenticated;
GRANT ALL ON public.admin_landing_leads TO service_role;

ALTER TABLE public.admin_landing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_landing_leads_select ON public.admin_landing_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'admin_pipeline')
  );

CREATE POLICY admin_landing_leads_update ON public.admin_landing_leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'admin_pipeline')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'admin_pipeline')
  );

CREATE POLICY admin_landing_leads_delete ON public.admin_landing_leads
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.admin_has_permission(auth.uid(), 'admin_pipeline')
  );

CREATE INDEX IF NOT EXISTS admin_landing_leads_created_at_idx
  ON public.admin_landing_leads (created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_landing_compute_match(_email text, _phone text)
RETURNS TABLE(match_status text, tenant_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(_email,'')));
  v_phone_digits text := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  v_email_tenant uuid;
  v_phone_tenant uuid;
BEGIN
  IF v_email <> '' THEN
    SELECT tenant_id INTO v_email_tenant FROM (
      SELECT tenant_id FROM public.zid_connections
        WHERE is_active = true AND lower(coalesce(store_email,'')) = v_email
      UNION ALL
      SELECT tenant_id FROM public.salla_connections
        WHERE is_active = true AND lower(coalesce(store_email,'')) = v_email
    ) x LIMIT 1;
  END IF;

  IF length(v_phone_digits) >= 6 THEN
    SELECT sa.user_id INTO v_phone_tenant
    FROM public.settings_account sa
    WHERE regexp_replace(coalesce(sa.phone,''), '\D', '', 'g') LIKE '%' || v_phone_digits || '%'
       OR v_phone_digits LIKE '%' || regexp_replace(coalesce(sa.phone,''), '\D', '', 'g') || '%'
    LIMIT 1;

    IF v_phone_tenant IS NOT NULL THEN
      SELECT atm.tenant_id INTO v_phone_tenant
      FROM public.auth_tenant_members atm
      WHERE atm.user_id = v_phone_tenant
        AND EXISTS (
          SELECT 1 FROM public.zid_connections z WHERE z.tenant_id = atm.tenant_id AND z.is_active = true
          UNION ALL
          SELECT 1 FROM public.salla_connections s WHERE s.tenant_id = atm.tenant_id AND s.is_active = true
        )
      LIMIT 1;
    END IF;
  END IF;

  IF v_email_tenant IS NOT NULL AND v_phone_tenant IS NOT NULL THEN
    RETURN QUERY SELECT 'full'::text, coalesce(v_email_tenant, v_phone_tenant);
  ELSIF v_email_tenant IS NOT NULL OR v_phone_tenant IS NOT NULL THEN
    RETURN QUERY SELECT 'partial'::text, coalesce(v_email_tenant, v_phone_tenant);
  ELSE
    RETURN QUERY SELECT 'none'::text, NULL::uuid;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_landing_leads_fill_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_tenant uuid;
BEGIN
  SELECT match_status, tenant_id INTO v_status, v_tenant
  FROM public.admin_landing_compute_match(NEW.email, NEW.phone);
  NEW.match_status := COALESCE(v_status, 'none');
  NEW.matched_tenant_id := v_tenant;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_landing_leads_fill_match ON public.admin_landing_leads;
CREATE TRIGGER trg_admin_landing_leads_fill_match
  BEFORE INSERT OR UPDATE OF email, phone
  ON public.admin_landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.admin_landing_leads_fill_match();

DROP TRIGGER IF EXISTS trg_admin_landing_leads_updated_at ON public.admin_landing_leads;
CREATE TRIGGER trg_admin_landing_leads_updated_at
  BEFORE UPDATE ON public.admin_landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
