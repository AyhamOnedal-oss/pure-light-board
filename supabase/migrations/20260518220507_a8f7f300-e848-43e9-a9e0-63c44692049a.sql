
CREATE OR REPLACE FUNCTION public.get_zid_credentials(p_tenant_id uuid)
RETURNS TABLE (
  store_id text,
  store_uuid text,
  authorization_token text,
  manager_token text,
  token_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id, store_uuid, authorization_token, manager_token, token_expires_at
  FROM public.zid_connections
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND connection_status = 'connected'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_zid_credentials(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_zid_credentials(uuid) TO anon, authenticated;

CREATE TABLE public.zid_rate_buckets (
  tenant_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, window_start)
);
ALTER TABLE public.zid_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_rate_buckets_member_view ON public.zid_rate_buckets
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.check_zid_rate_limit(
  p_tenant_id uuid,
  p_max integer DEFAULT 25
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
BEGIN
  INSERT INTO public.zid_rate_buckets(tenant_id, window_start, count)
  VALUES (p_tenant_id, v_window, 1)
  ON CONFLICT (tenant_id, window_start)
  DO UPDATE SET count = public.zid_rate_buckets.count + 1
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_zid_rate_limit(uuid, integer) TO anon, authenticated;

CREATE TABLE public.zid_api_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint text NOT NULL,
  http_status integer,
  request_body jsonb,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zid_api_errors_tenant_created_idx ON public.zid_api_errors(tenant_id, created_at DESC);
ALTER TABLE public.zid_api_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_api_errors_member_view ON public.zid_api_errors
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));

CREATE TABLE public.zid_token_refresh_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  http_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zid_token_refresh_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY zid_token_refresh_errors_member_view ON public.zid_token_refresh_errors
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id, auth.uid()));
