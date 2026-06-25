CREATE OR REPLACE FUNCTION public.admin_db_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bytes bigint;
  v_included bigint := 8::bigint * 1024 * 1024 * 1024; -- 8 GB
  v_percent numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT pg_database_size(current_database()) INTO v_bytes;
  v_percent := LEAST(100, ROUND((v_bytes::numeric / v_included::numeric) * 100, 2));
  RETURN jsonb_build_object(
    'bytes', v_bytes,
    'included_bytes', v_included,
    'percent', v_percent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_db_usage() TO authenticated;