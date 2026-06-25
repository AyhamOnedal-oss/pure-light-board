
-- 1) Update admin_kpis: Total Customers = distinct tenants with a Zid or Salla store connection
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
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_has_range THEN
    v_span := _to - _from;
    v_pto := _from;
    v_pfrom := _from - v_span;
  END IF;

  -- Total customers = distinct tenants with at least one Zid or Salla connection.
  -- A tenant's "join date" is the earliest created_at across its connections.
  WITH conns AS (
    SELECT tenant_id, created_at FROM public.zid_connections WHERE tenant_id IS NOT NULL
    UNION ALL
    SELECT tenant_id, created_at FROM public.salla_connections WHERE tenant_id IS NOT NULL
  ), first_conn AS (
    SELECT tenant_id, min(created_at) AS joined_at FROM conns GROUP BY tenant_id
  )
  SELECT count(*) INTO v_total FROM first_conn
  WHERE (NOT v_has_range OR (joined_at >= _from AND joined_at <= _to));

  IF v_has_range THEN
    WITH conns AS (
      SELECT tenant_id, created_at FROM public.zid_connections WHERE tenant_id IS NOT NULL
      UNION ALL
      SELECT tenant_id, created_at FROM public.salla_connections WHERE tenant_id IS NOT NULL
    ), first_conn AS (
      SELECT tenant_id, min(created_at) AS joined_at FROM conns GROUP BY tenant_id
    )
    SELECT count(*) INTO v_prev_total FROM first_conn
    WHERE joined_at >= v_pfrom AND joined_at < v_pto;
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

  -- Bubble clicks
  SELECT coalesce(sum(clicks),0) INTO v_clicks
  FROM public.dashboard_usage_daily
  WHERE (NOT v_has_range OR (day >= _from::date AND day <= _to::date));

  IF v_has_range THEN
    SELECT coalesce(sum(clicks),0) INTO v_prev_clicks
    FROM public.dashboard_usage_daily
    WHERE day >= v_pfrom::date AND day < v_pto::date;
  END IF;

  -- Avg response time across all tenants
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

-- 2) Add ticket_opened / ticket_closed to the notification kind enum
ALTER TYPE public.app_notification_kind ADD VALUE IF NOT EXISTS 'ticket_opened';
ALTER TYPE public.app_notification_kind ADD VALUE IF NOT EXISTS 'ticket_closed';

-- 3) Trigger: every ticket status change → a bell notification
CREATE OR REPLACE FUNCTION public.notify_ticket_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_open boolean;
  v_is_close boolean;
  v_code text;
  v_kind public.app_notification_kind;
  v_title_en text; v_title_ar text;
  v_msg_en text;   v_msg_ar text;
  v_actor text;
BEGIN
  IF NEW.type IS DISTINCT FROM 'status' OR NEW.status IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_open  := NEW.status IN ('open','in_progress','pending');
  v_is_close := NEW.status IN ('closed','resolved');
  IF NOT (v_is_open OR v_is_close) THEN
    RETURN NEW;
  END IF;

  SELECT display_code INTO v_code FROM public.tickets_main WHERE id = NEW.ticket_id;
  v_code := COALESCE(v_code, 'TKT-' || NEW.ticket_id::text);
  v_actor := COALESCE(NULLIF(btrim(NEW.author_name), ''), 'Someone');

  IF v_is_open THEN
    v_kind     := 'ticket_opened';
    v_title_en := 'Ticket opened';
    v_title_ar := 'تم فتح التذكرة';
    v_msg_en   := v_code || ' was opened by ' || v_actor || '.';
    v_msg_ar   := 'تم فتح التذكرة ' || v_code || ' بواسطة ' || v_actor || '.';
  ELSE
    v_kind     := 'ticket_closed';
    v_title_en := 'Ticket closed';
    v_title_ar := 'تم إغلاق التذكرة';
    v_msg_en   := v_code || ' was closed by ' || v_actor || '.';
    v_msg_ar   := 'تم إغلاق التذكرة ' || v_code || ' بواسطة ' || v_actor || '.';
  END IF;

  INSERT INTO public.app_notifications
    (tenant_id, kind, title_en, title_ar, message_en, message_ar)
  VALUES
    (NEW.tenant_id, v_kind, v_title_en, v_title_ar, v_msg_en, v_msg_ar);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_status_event ON public.tickets_activities;
CREATE TRIGGER trg_notify_ticket_status_event
AFTER INSERT ON public.tickets_activities
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_event();
