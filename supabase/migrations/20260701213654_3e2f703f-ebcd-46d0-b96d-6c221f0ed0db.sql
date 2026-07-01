-- 1) IQ Test daily caps: 300k input / 30k output
CREATE OR REPLACE FUNCTION public.iqtest_can_use(_tenant uuid)
 RETURNS TABLE(allowed boolean, input_used bigint, output_used bigint, input_cap bigint, output_cap bigint, resets_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _in bigint := 0; _out bigint := 0;
  _in_cap bigint := 300000;
  _out_cap bigint := 30000;
BEGIN
  SELECT input_tokens, output_tokens INTO _in, _out
  FROM public.iqtest_usage_today
  WHERE tenant_id = _tenant AND riyadh_day = public.riyadh_today();
  _in := COALESCE(_in, 0);
  _out := COALESCE(_out, 0);
  RETURN QUERY SELECT
    (_in < _in_cap AND _out < _out_cap),
    _in, _out, _in_cap, _out_cap,
    ((public.riyadh_today() + 1)::timestamp AT TIME ZONE 'Asia/Riyadh');
END $function$;

-- 2) Force inactivity mandatory + cap rating idle at 900s
CREATE OR REPLACE FUNCTION public.enforce_inactivity_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.inactivity_enabled := true;
  IF NEW.rating_inactivity_seconds IS NULL THEN
    NEW.rating_inactivity_seconds := 900;
  END IF;
  IF NEW.rating_inactivity_seconds > 900 THEN
    NEW.rating_inactivity_seconds := 900;
  END IF;
  IF NEW.rating_inactivity_seconds < 30 THEN
    NEW.rating_inactivity_seconds := 30;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_inactivity_rules ON public.settings_chat_design;
CREATE TRIGGER trg_enforce_inactivity_rules
BEFORE INSERT OR UPDATE ON public.settings_chat_design
FOR EACH ROW EXECUTE FUNCTION public.enforce_inactivity_rules();

UPDATE public.settings_chat_design
SET inactivity_enabled = true,
    rating_inactivity_seconds = LEAST(COALESCE(rating_inactivity_seconds, 900), 900);
