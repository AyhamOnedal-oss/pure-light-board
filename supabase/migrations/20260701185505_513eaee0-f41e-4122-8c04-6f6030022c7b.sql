
-- ============ Series RPCs (bucketized) ============

CREATE OR REPLACE FUNCTION public.admin_new_subs_series(
  _from timestamptz,
  _to   timestamptz,
  _bucket text DEFAULT 'day'
) RETURNS TABLE(bucket_start timestamptz, platform text, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bucket text := lower(coalesce(_bucket,'day'));
  v_interval interval;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_bucket NOT IN ('hour','day','week','month') THEN v_bucket := 'day'; END IF;
  v_interval := ('1 ' || v_bucket)::interval;

  RETURN QUERY
  WITH bounds AS (
    SELECT date_trunc(v_bucket, _from) AS b_from,
           date_trunc(v_bucket, _to)   AS b_to
  ),
  buckets AS (
    SELECT gs AS bucket_start
    FROM bounds, generate_series((SELECT b_from FROM bounds), (SELECT b_to FROM bounds), v_interval) gs
  ),
  zid_c AS (
    SELECT date_trunc(v_bucket, created_at) AS b, count(*)::int AS c
    FROM public.zid_connections
    WHERE created_at >= _from AND created_at <= _to
    GROUP BY 1
  ),
  salla_c AS (
    SELECT date_trunc(v_bucket, created_at) AS b, count(*)::int AS c
    FROM public.salla_connections
    WHERE created_at >= _from AND created_at <= _to
    GROUP BY 1
  ),
  grid AS (
    SELECT b.bucket_start, p.platform
    FROM buckets b CROSS JOIN (VALUES ('zid'),('salla')) p(platform)
  )
  SELECT g.bucket_start, g.platform,
    CASE g.platform
      WHEN 'zid'   THEN coalesce((SELECT c FROM zid_c   WHERE b = g.bucket_start), 0)
      WHEN 'salla' THEN coalesce((SELECT c FROM salla_c WHERE b = g.bucket_start), 0)
    END::int AS count
  FROM grid g
  ORDER BY g.bucket_start, g.platform;
END $$;

CREATE OR REPLACE FUNCTION public.admin_conversations_series(
  _from timestamptz,
  _to   timestamptz,
  _bucket text DEFAULT 'day'
) RETURNS TABLE(bucket_start timestamptz, count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bucket text := lower(coalesce(_bucket,'day'));
  v_interval interval;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_bucket NOT IN ('hour','day','week','month') THEN v_bucket := 'day'; END IF;
  v_interval := ('1 ' || v_bucket)::interval;

  RETURN QUERY
  WITH bounds AS (
    SELECT date_trunc(v_bucket, _from) AS b_from,
           date_trunc(v_bucket, _to)   AS b_to
  ),
  buckets AS (
    SELECT gs AS bucket_start
    FROM bounds, generate_series((SELECT b_from FROM bounds), (SELECT b_to FROM bounds), v_interval) gs
  ),
  c AS (
    SELECT date_trunc(v_bucket, created_at) AS b, count(*)::bigint AS n
    FROM public.conversations_main
    WHERE coalesce(is_test,false) = false
      AND created_at >= _from AND created_at <= _to
    GROUP BY 1
  )
  SELECT b.bucket_start, coalesce((SELECT n FROM c WHERE c.b = b.bucket_start), 0)::bigint
  FROM buckets b
  ORDER BY b.bucket_start;
END $$;

-- ============ Range-scoped snapshot RPCs ============

CREATE OR REPLACE FUNCTION public.admin_uninstalls_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(platform text, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH paid AS (
    SELECT id FROM public.settings_workspace
    WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
  ),
  z AS (
    SELECT count(*)::int AS c FROM public.zid_events
    WHERE lower(coalesce(event_type,'')) IN ('app.uninstalled','uninstall')
      AND tenant_id IN (SELECT id FROM paid)
      AND (NOT v_has OR (created_at >= _from AND created_at <= _to))
  ),
  s AS (
    SELECT count(*)::int AS c FROM public.salla_events
    WHERE lower(coalesce(event_type,'')) = 'app.uninstalled'
      AND tenant_id IN (SELECT id FROM paid)
      AND (NOT v_has OR (created_at >= _from AND created_at <= _to))
  )
  SELECT 'zid'::text, (SELECT c FROM z)
  UNION ALL SELECT 'salla'::text, (SELECT c FROM s);
END $$;

CREATE OR REPLACE FUNCTION public.admin_first_sub_type_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(plan text, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH bucketed AS (
    SELECT
      sw.id,
      CASE lower(coalesce(sw.plan,''))
        WHEN ''             THEN 'trial'
        WHEN 'free'         THEN 'trial'
        WHEN 'trial'        THEN 'trial'
        WHEN 'economy'      THEN 'economy'
        WHEN 'basic'        THEN 'basic'
        WHEN 'professional' THEN 'professional'
        WHEN 'pro'          THEN 'professional'
        WHEN 'business'     THEN 'business'
        ELSE 'trial'
      END AS b
    FROM public.settings_workspace sw
    WHERE (NOT v_has OR (sw.created_at >= _from AND sw.created_at <= _to))
  ),
  buckets(plan) AS (VALUES ('trial'),('economy'),('basic'),('professional'),('business'))
  SELECT b.plan,
         coalesce((SELECT count(*)::int FROM bucketed WHERE bucketed.b = b.plan), 0)
  FROM buckets b
  ORDER BY CASE b.plan
    WHEN 'trial' THEN 1 WHEN 'economy' THEN 2 WHEN 'basic' THEN 3
    WHEN 'professional' THEN 4 WHEN 'business' THEN 5 END;
END $$;

CREATE OR REPLACE FUNCTION public.admin_customer_source_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(platform text, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT 'zid'::text,
    (SELECT count(DISTINCT tenant_id)::int FROM public.zid_connections
      WHERE (NOT v_has OR (created_at >= _from AND created_at <= _to)))
  UNION ALL
  SELECT 'salla'::text,
    (SELECT count(DISTINCT tenant_id)::int FROM public.salla_connections
      WHERE (NOT v_has OR (created_at >= _from AND created_at <= _to)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_platform_subs_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(status text, platform text, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH zid_un AS (
    SELECT DISTINCT tenant_id FROM public.zid_events
    WHERE lower(coalesce(event_type,'')) IN ('app.uninstalled','uninstall')
      AND (NOT v_has OR (created_at >= _from AND created_at <= _to))
  ),
  salla_un AS (
    SELECT DISTINCT tenant_id FROM public.salla_events
    WHERE lower(coalesce(event_type,'')) = 'app.uninstalled'
      AND (NOT v_has OR (created_at >= _from AND created_at <= _to))
  ),
  zid_stores AS (
    SELECT coalesce(zc.store_uuid, zc.tenant_id::text) AS k,
      bool_or(zc.is_active) AS any_active,
      bool_or(lower(coalesce(sw.status::text,'')) = 'cancelled') AS tenant_cancelled,
      bool_or(zu.tenant_id IS NOT NULL) AS uninstalled
    FROM public.zid_connections zc
    LEFT JOIN public.settings_workspace sw ON sw.id = zc.tenant_id
    LEFT JOIN zid_un zu ON zu.tenant_id = zc.tenant_id
    WHERE (NOT v_has OR (zc.created_at >= _from AND zc.created_at <= _to))
    GROUP BY 1
  ),
  salla_stores AS (
    SELECT coalesce(sc.store_id, sc.tenant_id::text) AS k,
      bool_or(sc.is_active) AS any_active,
      bool_or(lower(coalesce(sw.status::text,'')) = 'cancelled') AS tenant_cancelled,
      bool_or(su.tenant_id IS NOT NULL) AS uninstalled
    FROM public.salla_connections sc
    LEFT JOIN public.settings_workspace sw ON sw.id = sc.tenant_id
    LEFT JOIN salla_un su ON su.tenant_id = sc.tenant_id
    WHERE (NOT v_has OR (sc.created_at >= _from AND sc.created_at <= _to))
    GROUP BY 1
  ),
  bucketed AS (
    SELECT 'zid'::text AS pf,
      CASE WHEN uninstalled THEN 'cancelled'
           WHEN any_active AND NOT tenant_cancelled THEN 'active'
           ELSE 'inactive' END AS st
    FROM zid_stores
    UNION ALL
    SELECT 'salla'::text,
      CASE WHEN uninstalled THEN 'cancelled'
           WHEN any_active AND NOT tenant_cancelled THEN 'active'
           ELSE 'inactive' END
    FROM salla_stores
  ),
  grid(st, pf) AS (
    SELECT s, p FROM (VALUES ('active'),('inactive'),('cancelled')) a(s)
    CROSS JOIN (VALUES ('zid'),('salla')) b(p)
  )
  SELECT g.st, g.pf,
    coalesce((SELECT count(*)::int FROM bucketed b WHERE b.st = g.st AND b.pf = g.pf), 0)
  FROM grid g
  ORDER BY g.st, g.pf;
END $$;

CREATE OR REPLACE FUNCTION public.admin_plan_distribution_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(platform text, plan text, subscribers integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH ws AS (
    SELECT sw.platform::text AS pf,
      CASE lower(coalesce(sw.plan,''))
        WHEN 'economy'      THEN 'economy'
        WHEN 'basic'        THEN 'basic'
        WHEN 'professional' THEN 'professional'
        WHEN 'pro'          THEN 'professional'
        WHEN 'business'     THEN 'business'
        ELSE NULL
      END AS pl
    FROM public.settings_workspace sw
    WHERE (NOT v_has OR (sw.created_at >= _from AND sw.created_at <= _to))
  ),
  grid(pf, pl) AS (
    SELECT p, l
    FROM (VALUES ('zid'),('salla')) a(p)
    CROSS JOIN (VALUES ('economy'),('basic'),('professional'),('business')) b(l)
  )
  SELECT g.pf, g.pl,
    coalesce((SELECT count(*)::int FROM ws WHERE ws.pf = g.pf AND ws.pl = g.pl), 0)
  FROM grid g
  ORDER BY g.pf, g.pl;
END $$;

CREATE OR REPLACE FUNCTION public.admin_new_subscribers_range(
  _from timestamptz, _to timestamptz
) RETURNS TABLE(
  tenant_id uuid,
  store_name text,
  platform text,
  subscribed_on timestamptz,
  monthly_word_quota integer,
  monthly_words_used integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_has boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH conn AS (
    SELECT zc.tenant_id, zc.store_name, 'zid'::text AS pf, zc.created_at
    FROM public.zid_connections zc
    WHERE (NOT v_has OR (zc.created_at >= _from AND zc.created_at <= _to))
    UNION ALL
    SELECT sc.tenant_id, sc.store_name, 'salla'::text, sc.created_at
    FROM public.salla_connections sc
    WHERE (NOT v_has OR (sc.created_at >= _from AND sc.created_at <= _to))
  )
  SELECT c.tenant_id, c.store_name, c.pf, c.created_at,
    coalesce(sp.monthly_word_quota, 0),
    coalesce(sp.monthly_words_used, 0)
  FROM conn c
  LEFT JOIN public.settings_plans sp ON sp.tenant_id = c.tenant_id
  ORDER BY c.created_at DESC;
END $$;

-- Grants
GRANT EXECUTE ON FUNCTION public.admin_new_subs_series(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_conversations_series(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_uninstalls_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_first_sub_type_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_customer_source_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_subs_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_plan_distribution_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_new_subscribers_range(timestamptz, timestamptz) TO authenticated;
