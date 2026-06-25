CREATE OR REPLACE FUNCTION public.admin_kpis(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0; v_prev_total int := 0;
  v_uninstalls int := 0; v_prev_uninstalls int := 0;
  v_clicks bigint := 0; v_prev_clicks bigint := 0;
  v_avg numeric := 0; v_prev_avg numeric := 0;
  v_span interval;
  v_pfrom timestamptz;
  v_pto timestamptz;
  v_has_range boolean := (_from IS NOT NULL AND _to IS NOT NULL);
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_has_range THEN
    v_span := _to - _from;
    v_pto := _from;
    v_pfrom := _from - v_span;
  END IF;

  -- Total customers = distinct non-admin auth users (matches Supabase Auth panel)
  SELECT count(*) INTO v_total
  FROM auth.users u
  WHERE (NOT v_has_range OR (u.created_at >= _from AND u.created_at <= _to))
    AND NOT EXISTS (
      SELECT 1 FROM public.auth_user_roles r
      WHERE r.user_id = u.id AND r.role = 'super_admin'::app_role
    );

  IF v_has_range THEN
    SELECT count(*) INTO v_prev_total
    FROM auth.users u
    WHERE u.created_at >= v_pfrom AND u.created_at < v_pto
      AND NOT EXISTS (
        SELECT 1 FROM public.auth_user_roles r
        WHERE r.user_id = u.id AND r.role = 'super_admin'::app_role
      );
  END IF;

  -- Uninstalls
  SELECT
    (SELECT count(*) FROM public.zid_connections
       WHERE is_active = false
         AND (NOT v_has_range OR (updated_at >= _from AND updated_at <= _to))) +
    (SELECT count(*) FROM public.salla_connections
       WHERE is_active = false
         AND (NOT v_has_range OR (updated_at >= _from AND updated_at <= _to)))
  INTO v_uninstalls;

  IF v_has_range THEN
    SELECT
      (SELECT count(*) FROM public.zid_connections
         WHERE is_active = false AND updated_at >= v_pfrom AND updated_at < v_pto) +
      (SELECT count(*) FROM public.salla_connections
         WHERE is_active = false AND updated_at >= v_pfrom AND updated_at < v_pto)
    INTO v_prev_uninstalls;
  END IF;

  -- Bubble clicks (all tenants)
  SELECT coalesce(sum(clicks),0) INTO v_clicks
  FROM public.dashboard_usage_daily
  WHERE (NOT v_has_range OR (day >= _from::date AND day <= _to::date));

  IF v_has_range THEN
    SELECT coalesce(sum(clicks),0) INTO v_prev_clicks
    FROM public.dashboard_usage_daily
    WHERE day >= v_pfrom::date AND day < v_pto::date;
  END IF;

  -- Avg response time across ALL tenants (gap between customer message and next ai/agent reply, capped at 1h)
  WITH m AS (
    SELECT conversation_id, sender, created_at,
           lead(sender)     OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_sender,
           lead(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at
    FROM public.conversations_messages
    WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to))
  ), gaps AS (
    SELECT extract(epoch FROM (next_at - created_at)) AS secs
    FROM m
    WHERE sender = 'customer'
      AND next_sender IN ('ai','agent')
      AND next_at IS NOT NULL
  )
  SELECT coalesce(avg(secs), 0) INTO v_avg
  FROM gaps WHERE secs >= 0 AND secs < 3600;

  IF v_has_range THEN
    WITH m AS (
      SELECT conversation_id, sender, created_at,
             lead(sender)     OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_sender,
             lead(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at
      FROM public.conversations_messages
      WHERE created_at >= v_pfrom AND created_at < v_pto
    ), gaps AS (
      SELECT extract(epoch FROM (next_at - created_at)) AS secs
      FROM m
      WHERE sender = 'customer'
        AND next_sender IN ('ai','agent')
        AND next_at IS NOT NULL
    )
    SELECT coalesce(avg(secs), 0) INTO v_prev_avg
    FROM gaps WHERE secs >= 0 AND secs < 3600;
  END IF;

  RETURN jsonb_build_object(
    'total_customers', v_total,
    'prev_total_customers', v_prev_total,
    'total_uninstalls', v_uninstalls,
    'prev_total_uninstalls', v_prev_uninstalls,
    'total_bubble_clicks', v_clicks,
    'prev_total_bubble_clicks', v_prev_clicks,
    'avg_response_seconds', round(v_avg::numeric, 2),
    'prev_avg_response_seconds', round(v_prev_avg::numeric, 2),
    'has_range', v_has_range
  );
END;
$function$;