CREATE OR REPLACE FUNCTION public.increment_widget_click(p_tenant_id uuid, p_day date DEFAULT ((now() at time zone 'utc')::date))
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.dashboard_usage_daily (tenant_id, day, clicks)
  VALUES (p_tenant_id, p_day, 1)
  ON CONFLICT (tenant_id, day) DO UPDATE
  SET clicks = public.dashboard_usage_daily.clicks + 1,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_widget_click(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_widget_click(uuid, date) TO service_role;