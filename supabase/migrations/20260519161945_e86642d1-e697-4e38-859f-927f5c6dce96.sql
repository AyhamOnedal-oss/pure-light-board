DROP FUNCTION IF EXISTS public.check_zid_rate_limit(uuid, integer);
DROP TABLE IF EXISTS public.zid_rate_buckets;
DROP TABLE IF EXISTS public.zid_api_errors;