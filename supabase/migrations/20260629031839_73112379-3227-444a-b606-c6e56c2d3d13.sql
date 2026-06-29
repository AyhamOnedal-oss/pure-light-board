CREATE OR REPLACE FUNCTION public.admin_new_subs_monthly(_year int DEFAULT NULL)
RETURNS TABLE(month int, platform text, count int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_year := COALESCE(_year, EXTRACT(year FROM (now() AT TIME ZONE 'Asia/Riyadh'))::int);

  RETURN QUERY
  WITH paid_tenants AS (
    SELECT id FROM public.settings_workspace
    WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
  ),
  zid_first AS (
    SELECT coalesce(store_uuid, tenant_id::text) AS store_key,
           min(created_at) AS first_at
    FROM public.zid_connections
    WHERE tenant_id IN (SELECT id FROM paid_tenants)
    GROUP BY coalesce(store_uuid, tenant_id::text)
  ),
  salla_first AS (
    SELECT coalesce(store_id, tenant_id::text) AS store_key,
           min(created_at) AS first_at
    FROM public.salla_connections
    WHERE tenant_id IN (SELECT id FROM paid_tenants)
    GROUP BY coalesce(store_id, tenant_id::text)
  ),
  zid_counts AS (
    SELECT EXTRACT(month FROM (first_at AT TIME ZONE 'Asia/Riyadh'))::int AS m,
           count(*)::int AS c
    FROM zid_first
    WHERE EXTRACT(year FROM (first_at AT TIME ZONE 'Asia/Riyadh'))::int = v_year
    GROUP BY 1
  ),
  salla_counts AS (
    SELECT EXTRACT(month FROM (first_at AT TIME ZONE 'Asia/Riyadh'))::int AS m,
           count(*)::int AS c
    FROM salla_first
    WHERE EXTRACT(year FROM (first_at AT TIME ZONE 'Asia/Riyadh'))::int = v_year
    GROUP BY 1
  ),
  months AS (SELECT generate_series(1,12) AS m)
  SELECT months.m AS month, p.platform,
         CASE p.platform
           WHEN 'zid'   THEN coalesce((SELECT c FROM zid_counts   WHERE zid_counts.m   = months.m), 0)
           WHEN 'salla' THEN coalesce((SELECT c FROM salla_counts WHERE salla_counts.m = months.m), 0)
         END AS count
  FROM months
  CROSS JOIN (VALUES ('zid'), ('salla')) AS p(platform)
  ORDER BY months.m, p.platform;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_new_subs_monthly(int) TO authenticated;