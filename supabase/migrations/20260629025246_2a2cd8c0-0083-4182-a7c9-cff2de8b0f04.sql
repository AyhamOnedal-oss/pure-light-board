CREATE OR REPLACE FUNCTION public.admin_kpis(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0; v_prev_total int := 0;
  v_uninstalls int := 0; v_prev_uninstalls int := 0;
  v_incomplete int := 0; v_prev_incomplete int := 0;
  v_clicks bigint := 0; v_prev_clicks bigint := 0;
  v_avg numeric := 0; v_prev_avg numeric := 0;
  v_span interval;
  v_pfrom timestamptz;
  v_pto   timestamptz;
  v_has_range boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_has_range THEN
    v_span := _to - _from;
    v_pto := _from;
    v_pfrom := _from - v_span;
  END IF;

  -- ============ 1) Total Customers = distinct tenants in zid/salla connections ============
  WITH conns AS (
    SELECT tenant_id, created_at FROM public.zid_connections
    UNION
    SELECT tenant_id, created_at FROM public.salla_connections
  )
  SELECT count(DISTINCT tenant_id) INTO v_total FROM conns
  WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to));

  IF v_has_range THEN
    WITH conns AS (
      SELECT tenant_id, created_at FROM public.zid_connections
      UNION
      SELECT tenant_id, created_at FROM public.salla_connections
    )
    SELECT count(DISTINCT tenant_id) INTO v_prev_total FROM conns
    WHERE created_at >= v_pfrom AND created_at < v_pto;
  END IF;

  -- ============ 2) Uninstalls = uninstall webhook events for paid plans only ============
  WITH paid_tenants AS (
    SELECT id FROM public.settings_workspace
    WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
  ),
  events AS (
    SELECT tenant_id, created_at FROM public.zid_events
      WHERE lower(coalesce(event_type,'')) IN ('app.uninstalled','uninstall')
    UNION ALL
    SELECT tenant_id, created_at FROM public.salla_events
      WHERE lower(coalesce(event_type,'')) = 'app.uninstalled'
  )
  SELECT count(*) INTO v_uninstalls
  FROM events e
  WHERE e.tenant_id IN (SELECT id FROM paid_tenants)
    AND (NOT v_has_range OR (e.created_at >= _from AND e.created_at <= _to));

  IF v_has_range THEN
    WITH paid_tenants AS (
      SELECT id FROM public.settings_workspace
      WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
    ),
    events AS (
      SELECT tenant_id, created_at FROM public.zid_events
        WHERE lower(coalesce(event_type,'')) IN ('app.uninstalled','uninstall')
      UNION ALL
      SELECT tenant_id, created_at FROM public.salla_events
        WHERE lower(coalesce(event_type,'')) = 'app.uninstalled'
    )
    SELECT count(*) INTO v_prev_uninstalls
    FROM events e
    WHERE e.tenant_id IN (SELECT id FROM paid_tenants)
      AND e.created_at >= v_pfrom AND e.created_at < v_pto;
  END IF;

  -- ============ 3) Incomplete Customers (deduped by email|phone) ============
  -- Source A: landing leads not fully matched
  -- Source B/C/D: tenants on free/trial plan (with or without an install)
  WITH leads AS (
    SELECT
      lower(btrim(coalesce(email,''))) AS email,
      regexp_replace(coalesce(phone,''), '\D', '', 'g') AS phone_digits,
      created_at
    FROM public.admin_landing_leads
    WHERE coalesce(match_status,'none') <> 'full'
  ),
  trial_tenants AS (
    SELECT
      sw.id AS tenant_id,
      lower(btrim(coalesce(
        (SELECT zc.store_email FROM public.zid_connections zc WHERE zc.tenant_id = sw.id LIMIT 1),
        (SELECT sc.store_email FROM public.salla_connections sc WHERE sc.tenant_id = sw.id LIMIT 1),
        ''
      ))) AS email,
      ''::text AS phone_digits,
      sw.created_at
    FROM public.settings_workspace sw
    WHERE lower(coalesce(sw.plan,'')) IN ('','free','trial')
      AND lower(coalesce(sw.status::text,'')) <> 'cancelled'
  ),
  unioned AS (
    SELECT email, phone_digits, created_at FROM leads
    UNION ALL
    SELECT email, phone_digits, created_at FROM trial_tenants
  ),
  keyed AS (
    SELECT
      CASE
        WHEN email = '' AND phone_digits = '' THEN 'row:' || row_number() OVER ()
        ELSE email || '|' || phone_digits
      END AS key,
      created_at
    FROM unioned
  )
  SELECT count(DISTINCT key) INTO v_incomplete
  FROM keyed
  WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to));

  IF v_has_range THEN
    WITH leads AS (
      SELECT lower(btrim(coalesce(email,''))) AS email,
             regexp_replace(coalesce(phone,''), '\D', '', 'g') AS phone_digits,
             created_at
      FROM public.admin_landing_leads
      WHERE coalesce(match_status,'none') <> 'full'
    ),
    trial_tenants AS (
      SELECT
        lower(btrim(coalesce(
          (SELECT zc.store_email FROM public.zid_connections zc WHERE zc.tenant_id = sw.id LIMIT 1),
          (SELECT sc.store_email FROM public.salla_connections sc WHERE sc.tenant_id = sw.id LIMIT 1),
          ''
        ))) AS email,
        ''::text AS phone_digits,
        sw.created_at
      FROM public.settings_workspace sw
      WHERE lower(coalesce(sw.plan,'')) IN ('','free','trial')
        AND lower(coalesce(sw.status::text,'')) <> 'cancelled'
    ),
    unioned AS (
      SELECT email, phone_digits, created_at FROM leads
      UNION ALL
      SELECT email, phone_digits, created_at FROM trial_tenants
    ),
    keyed AS (
      SELECT CASE
        WHEN email = '' AND phone_digits = '' THEN 'row:' || row_number() OVER ()
        ELSE email || '|' || phone_digits
      END AS key, created_at
      FROM unioned
    )
    SELECT count(DISTINCT key) INTO v_prev_incomplete
    FROM keyed
    WHERE created_at >= v_pfrom AND created_at < v_pto;
  END IF;

  -- ============ 4) Bubble clicks ============
  SELECT coalesce(sum(clicks),0) INTO v_clicks
  FROM public.dashboard_usage_daily
  WHERE (NOT v_has_range OR (day >= _from::date AND day <= _to::date));

  IF v_has_range THEN
    SELECT coalesce(sum(clicks),0) INTO v_prev_clicks
    FROM public.dashboard_usage_daily
    WHERE day >= v_pfrom::date AND day < v_pto::date;
  END IF;

  -- ============ 5) Avg response time ============
  WITH m AS (
    SELECT conversation_id, sender, created_at,
           lead(sender)     OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_sender,
           lead(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at
    FROM public.conversations_messages
    WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to))
  ), gaps AS (
    SELECT extract(epoch FROM (next_at - created_at)) AS secs
    FROM m WHERE sender = 'customer' AND next_sender IN ('ai','agent') AND next_at IS NOT NULL
  )
  SELECT coalesce(avg(secs),0) INTO v_avg FROM gaps WHERE secs >= 0 AND secs < 3600;

  IF v_has_range THEN
    WITH m AS (
      SELECT conversation_id, sender, created_at,
             lead(sender)     OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_sender,
             lead(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at
      FROM public.conversations_messages
      WHERE created_at >= v_pfrom AND created_at < v_pto
    ), gaps AS (
      SELECT extract(epoch FROM (next_at - created_at)) AS secs
      FROM m WHERE sender = 'customer' AND next_sender IN ('ai','agent') AND next_at IS NOT NULL
    )
    SELECT coalesce(avg(secs),0) INTO v_prev_avg FROM gaps WHERE secs >= 0 AND secs < 3600;
  END IF;

  RETURN jsonb_build_object(
    'total_customers', v_total,
    'prev_total_customers', v_prev_total,
    'total_uninstalls', v_uninstalls,
    'prev_total_uninstalls', v_prev_uninstalls,
    'incomplete_customers', v_incomplete,
    'prev_incomplete_customers', v_prev_incomplete,
    'inactive_customers', v_incomplete,           -- backwards-compat alias
    'prev_inactive_customers', v_prev_incomplete, -- backwards-compat alias
    'total_bubble_clicks', v_clicks,
    'prev_total_bubble_clicks', v_prev_clicks,
    'avg_response_seconds', round(v_avg::numeric, 2),
    'prev_avg_response_seconds', round(v_prev_avg::numeric, 2),
    'has_range', v_has_range
  );
END;
$function$;