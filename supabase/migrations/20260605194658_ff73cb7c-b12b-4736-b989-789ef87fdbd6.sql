
-- 1. Helper: does this user have access to a given section in this tenant?
create or replace function public.member_can(_tenant uuid, _user uuid, _key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.tenant_role_at_least(_tenant, _user, 'admin'::tenant_role), false)
    or coalesce(public.has_role(_user, 'super_admin'::app_role), false)
    or exists (
      select 1 from public.team_members
      where tenant_id = _tenant
        and user_id = _user
        and coalesce((permissions ->> _key)::boolean, false) = true
    );
$$;

grant execute on function public.member_can(uuid, uuid, text) to authenticated, anon, service_role;

-- 2. Lock SELECT on restricted tables
-- conversations_main
drop policy if exists conv_view on public.conversations_main;
create policy conv_view on public.conversations_main
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- conversations_messages
drop policy if exists msg_view on public.conversations_messages;
create policy msg_view on public.conversations_messages
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- conversations_customers
drop policy if exists customers_view on public.conversations_customers;
create policy customers_view on public.conversations_customers
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- conversations_channels
drop policy if exists channels_view on public.conversations_channels;
create policy channels_view on public.conversations_channels
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'conversations'));

-- tickets_main
drop policy if exists tickets_view on public.tickets_main;
create policy tickets_view on public.tickets_main
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'tickets'));

-- tickets_activities
drop policy if exists ticket_activities_view on public.tickets_activities;
create policy ticket_activities_view on public.tickets_activities
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'tickets'));

-- settings_train_ai
drop policy if exists ai_training_view on public.settings_train_ai;
create policy ai_training_view on public.settings_train_ai
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'settings_train_ai'));

-- settings_chat_design
drop policy if exists chat_widget_view on public.settings_chat_design;
create policy chat_widget_view on public.settings_chat_design
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'settings_chat_design'));

-- settings_plans
drop policy if exists quotas_view on public.settings_plans;
create policy quotas_view on public.settings_plans
  for select to authenticated
  using (public.member_can(tenant_id, auth.uid(), 'settings_plans'));

-- 3. Aggregated metrics function used by the Home dashboard so a locked
-- viewer can still see numbers. Bypasses RLS via security definer; we
-- gate on tenant membership before returning anything.
create or replace function public.dashboard_metrics(
  _tenant uuid,
  _from timestamptz,
  _to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

  -- Completion rate + classification breakdown
  with c as (
    select status, category from public.conversations_main
    where tenant_id = _tenant and is_test = false
      and created_at >= _from and created_at <= _to
  )
  select
    case when count(*) > 0
      then count(*) filter (where status in ('resolved','closed'))::numeric / count(*)
      else 0 end,
    coalesce(jsonb_object_agg(category, n) filter (where category is not null), '{}'::jsonb)
  into v_completion, v_classification
  from (
    select status, category, count(*) as n
    from c
    group by status, category
  ) g;

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
$$;

grant execute on function public.dashboard_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;
