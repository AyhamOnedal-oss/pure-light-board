
-- ============ KPI function ============
CREATE OR REPLACE FUNCTION public.admin_kpis(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Total customers (zid/salla tenants)
  SELECT count(*) INTO v_total
  FROM public.settings_workspace
  WHERE platform IN ('zid','salla')
    AND (NOT v_has_range OR (created_at >= _from AND created_at <= _to));

  IF v_has_range THEN
    SELECT count(*) INTO v_prev_total
    FROM public.settings_workspace
    WHERE platform IN ('zid','salla')
      AND created_at >= v_pfrom AND created_at < v_pto;
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

  -- Avg response time (seconds)
  SELECT coalesce(avg(extract(epoch FROM (first_response_at - created_at))),0)
  INTO v_avg
  FROM public.conversations_main
  WHERE first_response_at IS NOT NULL
    AND first_response_at > created_at
    AND (NOT v_has_range OR (created_at >= _from AND created_at <= _to));

  IF v_has_range THEN
    SELECT coalesce(avg(extract(epoch FROM (first_response_at - created_at))),0)
    INTO v_prev_avg
    FROM public.conversations_main
    WHERE first_response_at IS NOT NULL
      AND first_response_at > created_at
      AND created_at >= v_pfrom AND created_at < v_pto;
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_kpis(timestamptz, timestamptz) TO authenticated;

-- ============ Health checks ============
CREATE TABLE public.admin_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('up','degraded','down')),
  latency_ms int,
  http_code int,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_health_checks TO authenticated;
GRANT ALL ON public.admin_health_checks TO service_role;

ALTER TABLE public.admin_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read health"
  ON public.admin_health_checks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX admin_health_checks_provider_time_idx
  ON public.admin_health_checks (provider, checked_at DESC);
