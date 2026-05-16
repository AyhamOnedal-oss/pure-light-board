CREATE OR REPLACE FUNCTION public.bump_widget_clicks_from_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() at time zone 'utc')::date;
  v_type text := lower(coalesce(NEW.type, ''));
BEGIN
  IF v_type IN ('widget_open', 'bubble.click', 'bubble_click') THEN
    INSERT INTO public.dashboard_usage_daily (tenant_id, day, clicks)
    VALUES (NEW.tenant_id, v_today, 1)
    ON CONFLICT (tenant_id, day) DO UPDATE
    SET clicks = public.dashboard_usage_daily.clicks + 1,
        updated_at = now();
  ELSIF v_type IN ('widget_shown', 'bubble.shown', 'bubble_shown') THEN
    INSERT INTO public.dashboard_usage_daily (tenant_id, day)
    VALUES (NEW.tenant_id, v_today)
    ON CONFLICT (tenant_id, day) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS widget_events_bump_clicks ON public.widget_events;
CREATE TRIGGER widget_events_bump_clicks
  AFTER INSERT ON public.widget_events
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_widget_clicks_from_events();