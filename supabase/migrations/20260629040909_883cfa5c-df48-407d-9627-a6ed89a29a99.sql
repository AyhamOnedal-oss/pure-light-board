
-- ============ admin_settings: simple key/value for admin-controlled config ============
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read admin_settings" ON public.admin_settings;
CREATE POLICY "admins read admin_settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_dashboard'));

DROP POLICY IF EXISTS "admins write admin_settings" ON public.admin_settings;
CREATE POLICY "admins write admin_settings"
  ON public.admin_settings FOR ALL TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'admin_dashboard'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'admin_dashboard'));

-- Seed default OpenAI monthly word budget (admin can edit anytime)
INSERT INTO public.admin_settings (key, value)
VALUES ('openai_monthly_word_budget', to_jsonb(10000000))
ON CONFLICT (key) DO NOTHING;

-- ============ RPC: set the OpenAI monthly word budget ============
CREATE OR REPLACE FUNCTION public.admin_set_openai_word_budget(_words integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _words IS NULL OR _words < 0 THEN
    RAISE EXCEPTION 'invalid budget';
  END IF;
  INSERT INTO public.admin_settings (key, value, updated_at, updated_by)
  VALUES ('openai_monthly_word_budget', to_jsonb(_words), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  RETURN _words;
END;
$$;

-- ============ RPC: OpenAI usage vs admin budget (current month, all tenants) ============
-- Tokens come from public.ai_classifier_usage.total_tokens for classification/chat/vision.
-- Words = tokens * 0.75 (matches the conversion factor used elsewhere in the app).
CREATE OR REPLACE FUNCTION public.admin_openai_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_words bigint := 0;
  v_tokens bigint := 0;
  v_words bigint := 0;
  v_percent numeric := 0;
  v_period_start timestamptz;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE((value)::text::bigint, 0) INTO v_budget_words
  FROM public.admin_settings WHERE key = 'openai_monthly_word_budget';

  v_period_start := date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh'))
                    AT TIME ZONE 'Asia/Riyadh';

  SELECT COALESCE(SUM(total_tokens), 0)::bigint INTO v_tokens
  FROM public.ai_classifier_usage
  WHERE created_at >= v_period_start;

  v_words := (v_tokens::numeric * 0.75)::bigint;

  IF v_budget_words > 0 THEN
    v_percent := LEAST(100, ROUND((v_words::numeric / v_budget_words::numeric) * 100, 2));
  END IF;

  RETURN jsonb_build_object(
    'budget_words', v_budget_words,
    'used_tokens',  v_tokens,
    'used_words',   v_words,
    'percent',      v_percent,
    'period_start', v_period_start
  );
END;
$$;

-- ============ RPC: First Subscription Type ============
-- One row per tenant, bucketed by current settings_workspace.plan.
-- (No plan history table yet; "first" = current until we add one.)
CREATE OR REPLACE FUNCTION public.admin_first_sub_type()
RETURNS TABLE(plan text, count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH bucketed AS (
    SELECT
      sw.id,
      CASE lower(COALESCE(sw.plan, ''))
        WHEN ''          THEN 'trial'
        WHEN 'free'      THEN 'trial'
        WHEN 'trial'     THEN 'trial'
        WHEN 'economy'   THEN 'economy'
        WHEN 'basic'     THEN 'basic'
        WHEN 'professional' THEN 'professional'
        WHEN 'pro'       THEN 'professional'
        WHEN 'business'  THEN 'business'
        ELSE 'trial'
      END AS bucket
    FROM public.settings_workspace sw
  ),
  buckets(plan) AS (
    VALUES ('trial'),('economy'),('basic'),('professional'),('business')
  )
  SELECT b.plan,
         COALESCE((SELECT COUNT(*)::int FROM bucketed WHERE bucketed.bucket = b.plan), 0) AS count
  FROM buckets b
  ORDER BY CASE b.plan
    WHEN 'trial' THEN 1 WHEN 'economy' THEN 2 WHEN 'basic' THEN 3
    WHEN 'professional' THEN 4 WHEN 'business' THEN 5 END;
END;
$$;

-- ============ RPC: Subscriptions by Platform ============
-- Per platform, deduped by platform store key (store_uuid / store_id), fallback tenant_id.
--   active    = is_active = true AND tenant status <> 'cancelled'
--   cancelled = a matching uninstall event exists for that tenant
--   inactive  = is_active = false AND no uninstall event
CREATE OR REPLACE FUNCTION public.admin_platform_subs()
RETURNS TABLE(status text, platform text, count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH zid_un AS (
    SELECT DISTINCT tenant_id FROM public.zid_events
    WHERE lower(COALESCE(event_type,'')) IN ('app.uninstalled','uninstall')
  ),
  salla_un AS (
    SELECT DISTINCT tenant_id FROM public.salla_events
    WHERE lower(COALESCE(event_type,'')) = 'app.uninstalled'
  ),
  zid_stores AS (
    SELECT
      COALESCE(zc.store_uuid, zc.tenant_id::text) AS store_key,
      bool_or(zc.is_active)                       AS any_active,
      bool_or(lower(COALESCE(sw.status::text,'')) = 'cancelled') AS tenant_cancelled,
      bool_or(zu.tenant_id IS NOT NULL)           AS uninstalled
    FROM public.zid_connections zc
    LEFT JOIN public.settings_workspace sw ON sw.id = zc.tenant_id
    LEFT JOIN zid_un zu ON zu.tenant_id = zc.tenant_id
    GROUP BY 1
  ),
  salla_stores AS (
    SELECT
      COALESCE(sc.store_id, sc.tenant_id::text) AS store_key,
      bool_or(sc.is_active)                     AS any_active,
      bool_or(lower(COALESCE(sw.status::text,'')) = 'cancelled') AS tenant_cancelled,
      bool_or(su.tenant_id IS NOT NULL)         AS uninstalled
    FROM public.salla_connections sc
    LEFT JOIN public.settings_workspace sw ON sw.id = sc.tenant_id
    LEFT JOIN salla_un su ON su.tenant_id = sc.tenant_id
    GROUP BY 1
  ),
  bucketed AS (
    SELECT 'zid'::text AS platform,
      CASE
        WHEN uninstalled THEN 'cancelled'
        WHEN any_active AND NOT tenant_cancelled THEN 'active'
        ELSE 'inactive'
      END AS status
    FROM zid_stores
    UNION ALL
    SELECT 'salla'::text,
      CASE
        WHEN uninstalled THEN 'cancelled'
        WHEN any_active AND NOT tenant_cancelled THEN 'active'
        ELSE 'inactive'
      END
    FROM salla_stores
  ),
  grid(status, platform) AS (
    SELECT s, p FROM (VALUES ('active'),('inactive'),('cancelled')) AS a(s)
    CROSS JOIN (VALUES ('zid'),('salla')) AS b(p)
  )
  SELECT g.status, g.platform,
         COALESCE((SELECT COUNT(*)::int FROM bucketed b
                   WHERE b.status = g.status AND b.platform = g.platform), 0)
  FROM grid g
  ORDER BY g.status, g.platform;
END;
$$;

-- ============ RPC: Uninstall comparison (paid plans only) ============
CREATE OR REPLACE FUNCTION public.admin_uninstalls_compare()
RETURNS TABLE(platform text, count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'admin_dashboard') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT id FROM public.settings_workspace
    WHERE lower(COALESCE(plan,'')) IN ('economy','basic','professional','business','pro')
  ),
  zid_cnt AS (
    SELECT COUNT(*)::int AS c FROM public.zid_events
    WHERE lower(COALESCE(event_type,'')) IN ('app.uninstalled','uninstall')
      AND tenant_id IN (SELECT id FROM paid)
  ),
  salla_cnt AS (
    SELECT COUNT(*)::int AS c FROM public.salla_events
    WHERE lower(COALESCE(event_type,'')) = 'app.uninstalled'
      AND tenant_id IN (SELECT id FROM paid)
  )
  SELECT 'zid'::text,   (SELECT c FROM zid_cnt)
  UNION ALL
  SELECT 'salla'::text, (SELECT c FROM salla_cnt);
END;
$$;
