CREATE OR REPLACE FUNCTION public.dashboard_metrics(_tenant uuid, _from timestamp with time zone, _to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_conversations int := 0;
  v_messages_in int := 0;
  v_messages_out int := 0;
  v_tickets_total int := 0;
  v_tickets_open int := 0;
  v_tickets_closed int := 0;
  v_words_used bigint := 0;
  v_widget_clicks bigint := 0;
  v_avg_response numeric := 0;
  v_completion numeric := 0;
  v_classification jsonb := '{}'::jsonb;
  v_feedback_pos int := 0;
  v_feedback_neg int := 0;
  v_csat jsonb := jsonb_build_object('1',0,'2',0,'3',0,'4',0,'5',0,'total',0,'avg',0);
begin
  if not public.is_tenant_member(_tenant, auth.uid())
     and not public.has_role(auth.uid(), 'super_admin'::app_role) then
    raise exception 'not a tenant member';
  end if;

  select count(*) into v_conversations
  from public.conversations_main
  where tenant_id = _tenant and is_test = false
    and created_at >= _from and created_at <= _to;

  select
    count(*) filter (where sender = 'customer'),
    count(*) filter (where sender in ('ai','agent'))
  into v_messages_in, v_messages_out
  from public.conversations_messages
  where tenant_id = _tenant
    and created_at >= _from and created_at <= _to;

  select coalesce(sum(word_count), 0) into v_words_used
  from public.conversations_messages
  where tenant_id = _tenant and sender in ('ai','agent')
    and created_at >= _from and created_at <= _to;

  select
    count(*),
    count(*) filter (where status in ('open','in_progress','pending')),
    count(*) filter (where status in ('resolved','closed'))
  into v_tickets_total, v_tickets_open, v_tickets_closed
  from public.tickets_main
  where tenant_id = _tenant
    and created_at >= _from and created_at <= _to;

  select coalesce(sum(clicks), 0) into v_widget_clicks
  from public.dashboard_usage_daily
  where tenant_id = _tenant
    and day >= _from::date and day <= _to::date;

  -- Completion rate (per conversation, not per group row)
  select case when count(*) > 0
           then count(*) filter (where status in ('resolved','closed'))::numeric / count(*)
           else 0 end
  into v_completion
  from public.conversations_main
  where tenant_id = _tenant and is_test = false
    and created_at >= _from and created_at <= _to;

  -- Classification breakdown, one count per category (no duplicate keys)
  select coalesce(jsonb_object_agg(category, n) filter (where category is not null), '{}'::jsonb)
  into v_classification
  from (
    select category, count(*)::int as n
    from public.conversations_main
    where tenant_id = _tenant and is_test = false
      and created_at >= _from and created_at <= _to
    group by category
  ) g;

  -- Avg response time: gap between a customer message and the next ai/agent
  -- reply within the same conversation. Cap at 1h; ignore negatives.
  with m as (
    select conversation_id, sender, created_at,
           lead(sender)     over (partition by conversation_id order by created_at) as next_sender,
           lead(created_at) over (partition by conversation_id order by created_at) as next_at
    from public.conversations_messages
    where tenant_id = _tenant
      and created_at >= _from and created_at <= _to
  ), gaps as (
    select extract(epoch from (next_at - created_at)) as secs
    from m
    where sender = 'customer'
      and next_sender in ('ai','agent')
      and next_at is not null
  )
  select coalesce(avg(secs), 0) into v_avg_response
  from gaps
  where secs >= 0 and secs < 3600;

  -- CSAT
  with r as (
    select csat_rating::int as v
    from public.conversations_main
    where tenant_id = _tenant and is_test = false
      and csat_rating is not null
      and created_at >= _from and created_at <= _to
  )
  select jsonb_build_object(
    '1', count(*) filter (where v = 1),
    '2', count(*) filter (where v = 2),
    '3', count(*) filter (where v = 3),
    '4', count(*) filter (where v = 4),
    '5', count(*) filter (where v = 5),
    'total', count(*),
    'avg', case when count(*) > 0 then avg(v) else 0 end
  ) into v_csat from r;

  -- Feedback (thumbs)
  select
    count(*) filter (where feedback = 'positive'),
    count(*) filter (where feedback = 'negative')
  into v_feedback_pos, v_feedback_neg
  from public.conversations_messages
  where tenant_id = _tenant and sender in ('ai','agent') and feedback is not null
    and created_at >= _from and created_at <= _to;

  v_result := jsonb_build_object(
    'conversations', v_conversations,
    'messagesIn', v_messages_in,
    'messagesOut', v_messages_out,
    'wordsUsed', v_words_used,
    'widgetClicks', v_widget_clicks,
    'avgResponseSeconds', v_avg_response,
    'ticketsTotal', v_tickets_total,
    'ticketsOpen', v_tickets_open,
    'ticketsClosed', v_tickets_closed,
    'csat', v_csat,
    'completionRate', v_completion,
    'classification', v_classification,
    'feedback', jsonb_build_object(
      'positive', v_feedback_pos,
      'negative', v_feedback_neg,
      'total', v_feedback_pos + v_feedback_neg
    )
  );

  return v_result;
end;
$function$;