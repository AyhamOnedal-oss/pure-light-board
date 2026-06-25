
-- 1) Link admin staff to auth users
ALTER TABLE public.admin_team_members
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS admin_team_members_user_id_idx
  ON public.admin_team_members(user_id);
CREATE INDEX IF NOT EXISTS admin_team_members_email_lower_idx
  ON public.admin_team_members(lower(email));

-- Backfill user_id from auth.users by email (case-insensitive)
UPDATE public.admin_team_members m
SET user_id = u.id
FROM auth.users u
WHERE m.user_id IS NULL
  AND lower(u.email) = lower(m.email);

-- 2) Permission helper for admin panel
-- Returns true when caller is super_admin OR is an active admin_team_members
-- row whose permissions array contains the requested key.
CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.admin_team_members
      WHERE user_id = _user_id
        AND status = 'active'
        AND _key = ANY (permissions)
    );
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_permission(uuid, text) TO authenticated, service_role;

-- Convenience: any admin-panel access (any single permission OR super_admin)
CREATE OR REPLACE FUNCTION public.admin_has_any_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.admin_team_members
      WHERE user_id = _user_id
        AND status = 'active'
        AND array_length(permissions, 1) IS NOT NULL
    );
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_any_access(uuid) TO authenticated, service_role;

-- 3) Open up admin_* read policies for permitted staff
-- Pattern: drop old super_admin-only policy, recreate with admin_has_permission.

DO $$
DECLARE
  r record;
  perm text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, perm_key FROM (VALUES
      ('admin_dash_kpi_snapshots',     'admin_dash_kpi_snapshots_admin_all',     'admin_dashboard'),
      ('admin_dash_words_monthly',     'admin_dash_words_monthly_admin_all',     'admin_dashboard'),
      ('admin_dash_new_subs_monthly',  'admin_dash_new_subs_monthly_admin_all',  'admin_dashboard'),
      ('admin_dash_plan_distribution', 'admin_dash_plan_distribution_admin_all', 'admin_dashboard'),
      ('admin_dash_platform_subs',     'admin_dash_platform_subs_admin_all',     'admin_dashboard'),
      ('admin_dash_first_sub_type',    'admin_dash_first_sub_type_admin_all',    'admin_dashboard'),
      ('admin_dash_customer_source',   'admin_dash_customer_source_admin_all',   'admin_dashboard'),
      ('admin_dash_uninstalls',        'admin_dash_uninstalls_admin_all',        'admin_dashboard'),
      ('admin_dash_new_subscribers',   'admin_dash_new_subscribers_admin_all',   'admin_dashboard'),
      ('admin_dash_servers',           'admin_dash_servers_admin_all',           'admin_dashboard'),
      ('admin_customers_seed',         'admin_customers_seed_admin_all',         'customers'),
      ('admin_reports_plans',          'admin_reports_plans_admin_all',          'reports'),
      ('admin_reports_revenue_monthly','admin_reports_revenue_monthly_admin_all','reports'),
      ('admin_invoices_subscriptions', 'admin_invoices_subscriptions_admin_all', 'billing'),
      ('admin_invoices_servers',       'admin_invoices_servers_admin_all',       'billing'),
      ('admin_invoices_other',         'admin_invoices_other_admin_all',         'billing'),
      ('admin_ad_platforms',           'admin_ad_platforms_admin_all',           'ad_automation'),
      ('admin_ad_campaigns',           'admin_ad_campaigns_admin_all',           'ad_automation')
    ) AS t(tablename, policyname, perm_key)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    -- SELECT for any permitted staff
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), %L))',
      r.policyname || '_read', r.tablename, r.perm_key
    );
    -- Write only for super_admin (keeps mutations safe by default)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))',
      r.policyname || '_write', r.tablename
    );
  END LOOP;
END $$;

-- admin_team_members: super admin manages all; staff with team_management can read
DROP POLICY IF EXISTS admin_team_members_admin_all ON public.admin_team_members;
CREATE POLICY admin_team_members_super_all ON public.admin_team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY admin_team_members_staff_read ON public.admin_team_members
  FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'team_management'));

-- admin_health_checks: read for any admin staff (page is dashboard surface)
DROP POLICY IF EXISTS "super_admin can read health" ON public.admin_health_checks;
CREATE POLICY admin_health_checks_read ON public.admin_health_checks
  FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_dashboard'));

-- 4) Update RPCs to allow permitted staff
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
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_has_range THEN
    v_span := _to - _from;
    v_pto := _from;
    v_pfrom := _from - v_span;
  END IF;

  SELECT count(*) INTO v_total
  FROM auth.users u
  WHERE (NOT v_has_range OR (u.created_at >= _from AND u.created_at <= _to))
    AND NOT EXISTS (
      SELECT 1 FROM public.auth_user_roles r
      WHERE r.user_id = u.id AND r.role IN ('super_admin'::app_role, 'admin'::app_role)
    );

  IF v_has_range THEN
    SELECT count(*) INTO v_prev_total
    FROM auth.users u
    WHERE u.created_at >= v_pfrom AND u.created_at < v_pto
      AND NOT EXISTS (
        SELECT 1 FROM public.auth_user_roles r
        WHERE r.user_id = u.id AND r.role IN ('super_admin'::app_role, 'admin'::app_role)
      );
  END IF;

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

  SELECT coalesce(sum(clicks),0) INTO v_clicks
  FROM public.dashboard_usage_daily
  WHERE (NOT v_has_range OR (day >= _from::date AND day <= _to::date));

  IF v_has_range THEN
    SELECT coalesce(sum(clicks),0) INTO v_prev_clicks
    FROM public.dashboard_usage_daily
    WHERE day >= v_pfrom::date AND day < v_pto::date;
  END IF;

  WITH m AS (
    SELECT conversation_id, sender, created_at,
           lead(sender)     OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_sender,
           lead(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_at
    FROM public.conversations_messages
    WHERE (NOT v_has_range OR (created_at >= _from AND created_at <= _to))
  ), gaps AS (
    SELECT extract(epoch FROM (next_at - created_at)) AS secs
    FROM m
    WHERE sender = 'customer' AND next_sender IN ('ai','agent') AND next_at IS NOT NULL
  )
  SELECT coalesce(avg(secs), 0) INTO v_avg FROM gaps WHERE secs >= 0 AND secs < 3600;

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
      WHERE sender = 'customer' AND next_sender IN ('ai','agent') AND next_at IS NOT NULL
    )
    SELECT coalesce(avg(secs), 0) INTO v_prev_avg FROM gaps WHERE secs >= 0 AND secs < 3600;
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

CREATE OR REPLACE FUNCTION public.admin_db_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bytes bigint;
  v_included bigint := 8::bigint * 1024 * 1024 * 1024;
  v_percent numeric;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
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
$function$;
