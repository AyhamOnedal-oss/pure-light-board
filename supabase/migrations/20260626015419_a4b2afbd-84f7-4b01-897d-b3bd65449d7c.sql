
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
  v_phone_user uuid;
BEGIN
  IF v_email <> '' THEN
    SELECT x.t INTO v_email_tenant FROM (
      SELECT zc.tenant_id AS t FROM public.zid_connections zc
        WHERE zc.is_active = true AND lower(coalesce(zc.store_email,'')) = v_email
      UNION ALL
      SELECT sc.tenant_id AS t FROM public.salla_connections sc
        WHERE sc.is_active = true AND lower(coalesce(sc.store_email,'')) = v_email
    ) x LIMIT 1;
  END IF;

  IF length(v_phone_digits) >= 6 THEN
    SELECT sa.user_id INTO v_phone_user
    FROM public.settings_account sa
    WHERE regexp_replace(coalesce(sa.phone,''), '\D', '', 'g') LIKE '%' || v_phone_digits || '%'
       OR v_phone_digits LIKE '%' || regexp_replace(coalesce(sa.phone,''), '\D', '', 'g') || '%'
    LIMIT 1;

    IF v_phone_user IS NOT NULL THEN
      SELECT atm.tenant_id INTO v_phone_tenant
      FROM public.auth_tenant_members atm
      WHERE atm.user_id = v_phone_user
        AND (
          EXISTS (SELECT 1 FROM public.zid_connections z WHERE z.tenant_id = atm.tenant_id AND z.is_active = true)
          OR EXISTS (SELECT 1 FROM public.salla_connections s WHERE s.tenant_id = atm.tenant_id AND s.is_active = true)
        )
      LIMIT 1;
    END IF;
  END IF;

  IF v_email_tenant IS NOT NULL AND v_phone_tenant IS NOT NULL THEN
    RETURN QUERY SELECT 'full'::text, COALESCE(v_email_tenant, v_phone_tenant);
  ELSIF v_email_tenant IS NOT NULL OR v_phone_tenant IS NOT NULL THEN
    RETURN QUERY SELECT 'partial'::text, COALESCE(v_email_tenant, v_phone_tenant);
  ELSE
    RETURN QUERY SELECT 'none'::text, NULL::uuid;
  END IF;
END;
$$;
