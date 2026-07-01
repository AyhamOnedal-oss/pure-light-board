CREATE OR REPLACE FUNCTION public.admin_kpis(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0; v_prev_total int := 0;
  v_active int := 0; v_prev_active int := 0;
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

  -- 1) Total Customers = paid subscribers (active OR cancelled)
  SELECT count(*) INTO v_total
  FROM public.settings_workspace w
  WHERE lower(coalesce(w.plan,'')) IN ('economy','basic','professional','business','pro')
    AND lower(coalesce(w.status::text,'')) IN ('active','cancelled','canceled')
    AND (NOT v_has_range OR (w.created_at >= _from AND w.created_at <= _to));

  IF v_has_range THEN
    SELECT count(*) INTO v_prev_total
    FROM public.settings_workspace w
    WHERE lower(coalesce(w.plan,'')) IN ('economy','basic','professional','business','pro')
      AND lower(coalesce(w.status::text,'')) IN ('active','cancelled','canceled')
      AND w.created_at >= v_pfrom AND w.created_at < v_pto;
  END IF;

  -- 2) Active Customers = currently active on a paid plan
  SELECT count(*) INTO v_active
  FROM public.settings_workspace w
  WHERE lower(coalesce(w.plan,'')) IN ('economy','basic','professional','business','pro')
    AND lower(coalesce(w.status::text,'')) = 'active'
    AND (NOT v_has_range OR (w.created_at >= _from AND w.created_at <= _to));

  IF v_has_range THEN
    SELECT count(*) INTO v_prev_active
    FROM public.settings_workspace w
    WHERE lower(coalesce(w.plan,'')) IN ('economy','basic','professional','business','pro')
      AND lower(coalesce(w.status::text,'')) = 'active'
      AND w.created_at >= v_pfrom AND w.created_at < v_pto;
  END IF;

  -- 3) Uninstalls (paid tenants)
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

  -- 4) Incomplete Customers = leads + non-paid, non-cancelled tenants
  WITH paid_ws AS (
    SELECT id FROM public.settings_workspace
    WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
  ),
  leads AS (
    SELECT
      lower(btrim(coalesce(email,''))) AS email,
      regexp_replace(coalesce(phone,''), '\D', '', 'g') AS phone_digits,
      created_at
    FROM public.admin_landing_leads
    WHERE coalesce(match_status,'none') <> 'full'
  ),
  trial_ws AS (
    SELECT
      ('ws:' || id::text) AS email,
      ''::text AS phone_digits,
      created_at
    FROM public.settings_workspace
    WHERE id NOT IN (SELECT id FROM paid_ws)
      AND lower(coalesce(status::text,'')) NOT IN ('cancelled','canceled')
  ),
  unioned AS (
    SELECT email, phone_digits, created_at FROM leads
    UNION ALL
    SELECT email, phone_digits, created_at FROM trial_ws
  ),
  keyed AS (
    SELECT CASE
      WHEN email = '' AND phone_digits = '' THEN 'row:' || row_number() OVER ()
      ELSE email || '|' || phone_digits
    END AS key, created_at
    FROM unioned
  )
  SELECT count(DISTINCT key) INTO v_incomplete
  FROM keyed
  WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to));

  IF v_has_range THEN
    WITH paid_ws AS (
      SELECT id FROM public.settings_workspace
      WHERE lower(coalesce(plan,'')) IN ('economy','basic','professional','business','pro')
    ),
    leads AS (
      SELECT lower(btrim(coalesce(email,''))) AS email,
             regexp_replace(coalesce(phone,''), '\D', '', 'g') AS phone_digits,
             created_at
      FROM public.admin_landing_leads
      WHERE coalesce(match_status,'none') <> 'full'
    ),
    trial_ws AS (
      SELECT ('ws:' || id::text) AS email,
             ''::text AS phone_digits,
             created_at
      FROM public.settings_workspace
      WHERE id NOT IN (SELECT id FROM paid_ws)
        AND lower(coalesce(status::text,'')) NOT IN ('cancelled','canceled')
    ),
    unioned AS (
      SELECT email, phone_digits, created_at FROM leads
      UNION ALL SELECT email, phone_digits, created_at FROM trial_ws
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

  -- 5) Bubble clicks
  SELECT coalesce(sum(clicks),0) INTO v_clicks
  FROM public.dashboard_usage_daily
  WHERE (NOT v_has_range OR (day >= _from::date AND day <= _to::date));

  IF v_has_range THEN
    SELECT coalesce(sum(clicks),0) INTO v_prev_clicks
    FROM public.dashboard_usage_daily
    WHERE day >= v_pfrom::date AND day < v_pto::date;
  END IF;

  -- 6) Avg response time
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
    'active_customers', v_active,
    'prev_active_customers', v_prev_active,
    'total_uninstalls', v_uninstalls,
    'prev_total_uninstalls', v_prev_uninstalls,
    'incomplete_customers', v_incomplete,
    'prev_incomplete_customers', v_prev_incomplete,
    'inactive_customers', v_incomplete,
    'prev_inactive_customers', v_prev_incomplete,
    'total_bubble_clicks', v_clicks,
    'prev_total_bubble_clicks', v_prev_clicks,
    'avg_response_seconds', round(v_avg::numeric, 2),
    'prev_avg_response_seconds', round(v_prev_avg::numeric, 2),
    'has_range', v_has_range
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_kpis(timestamptz, timestamptz) TO authenticated, service_role;