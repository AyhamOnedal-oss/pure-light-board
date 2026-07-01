CREATE OR REPLACE FUNCTION public.admin_conversations_monthly(_year int)
RETURNS TABLE(month int, conversations bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(1, 12) AS m
  ),
  counts AS (
    SELECT extract(month FROM created_at)::int AS m, count(*)::bigint AS c
    FROM public.conversations_main
    WHERE coalesce(is_test, false) = false
      AND extract(year FROM created_at)::int = _year
    GROUP BY 1
  )
  SELECT months.m AS month, coalesce(counts.c, 0)::bigint AS conversations
  FROM months
  LEFT JOIN counts ON counts.m = months.m
  ORDER BY months.m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_conversations_monthly(int) TO authenticated;