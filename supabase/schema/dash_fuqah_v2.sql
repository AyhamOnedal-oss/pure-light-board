-- ============================================================
-- dash fuqah — v2 schema (idempotent)
-- Project: kyohutbusszojssbgbvw
-- Maps 1:1 to /dashboard widgets in DashboardPage.tsx
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin
  create type public.app_role as enum ('admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_classification as enum ('complaint','inquiry','request','suggestion','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_status as enum ('active','completed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_sender as enum ('customer','ai','agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_feedback as enum ('positive','negative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('open','in_progress','resolved','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.insight_category as enum ('complaints','requests','inquiries','suggestions','unknown');
exception when duplicate_object then null; end $$;

-- ---------- Generic updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- Identity & access
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============================================================
-- Stores & membership
-- ============================================================

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  store_logo text,
  api_endpoint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated before update on public.stores
  for each row execute function public.set_updated_at();
create index if not exists idx_stores_owner on public.stores(owner_id);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);
create index if not exists idx_store_members_user on public.store_members(user_id);

create or replace function public.is_store_member(_user_id uuid, _store_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.stores where id = _store_id and owner_id = _user_id
  ) or exists (
    select 1 from public.store_members where store_id = _store_id and user_id = _user_id
  )
$$;

-- ============================================================
-- Conversations & messages
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_phone text,
  customer_name text,
  classification public.conversation_classification not null default 'unknown',
  status public.conversation_status not null default 'active',
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_conversations_updated on public.conversations;
create trigger trg_conversations_updated before update on public.conversations
  for each row execute function public.set_updated_at();
create index if not exists idx_conv_store_created on public.conversations(store_id, created_at desc);
create index if not exists idx_conv_classification on public.conversations(store_id, classification);
create index if not exists idx_conv_status on public.conversations(store_id, status);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender public.message_sender not null,
  content text not null,
  media_url text,
  feedback public.message_feedback,
  feedback_note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);
create index if not exists idx_messages_feedback on public.messages(conversation_id) where feedback is not null;

create or replace function public.bump_conversation_on_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
     set message_count = message_count + 1,
         last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_messages_bump on public.messages;
create trigger trg_messages_bump after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- ============================================================
-- Tickets
-- ============================================================

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_phone text not null,
  customer_name text,
  title_en text,
  title_ar text,
  description_en text,
  description_ar text,
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_tickets_updated on public.tickets;
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.set_updated_at();
create index if not exists idx_tickets_store on public.tickets(store_id, created_at desc);
create index if not exists idx_tickets_status on public.tickets(store_id, status);

-- Auto-generate TKT-XXXXX (collision-safe via unique + retry loop)
create or replace function public.gen_ticket_number()
returns trigger language plpgsql as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.ticket_number is not null and new.ticket_number <> '' then
    return new;
  end if;
  loop
    candidate := 'TKT-' || lpad(floor(random()*100000)::text, 5, '0');
    exit when not exists (select 1 from public.tickets where ticket_number = candidate);
    attempts := attempts + 1;
    if attempts > 10 then
      candidate := 'TKT-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 8);
      exit;
    end if;
  end loop;
  new.ticket_number := candidate;
  return new;
end $$;

drop trigger if exists trg_tickets_number on public.tickets;
create trigger trg_tickets_number before insert on public.tickets
  for each row execute function public.gen_ticket_number();

-- ============================================================
-- Ratings
-- ============================================================

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ratings_store on public.ratings(store_id, created_at desc);

-- ============================================================
-- Insights (powers the modal)
-- ============================================================

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category public.insight_category not null,
  label_en text not null,
  label_ar text not null,
  count integer not null default 1,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_insights_updated on public.insights;
create trigger trg_insights_updated before update on public.insights
  for each row execute function public.set_updated_at();
create index if not exists idx_insights_store_cat on public.insights(store_id, category, count desc);

-- ============================================================
-- Bubble clicks
-- ============================================================

create table if not exists public.bubble_clicks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text,
  clicked_at timestamptz not null default now()
);
create index if not exists idx_bubble_store on public.bubble_clicks(store_id, clicked_at desc);

-- ============================================================
-- Daily analytics (one row per store per day) — drives KPIs/charts
-- ============================================================

create table if not exists public.daily_analytics (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,

  total_conversations integer not null default 0,
  completion_rate numeric(5,2) not null default 0,
  total_tickets integer not null default 0,
  open_tickets integer not null default 0,
  closed_tickets integer not null default 0,
  words_consumed integer not null default 0,
  bubble_clicks integer not null default 0,
  avg_response_time_seconds numeric(10,2) not null default 0,

  complaints_count integer not null default 0,
  inquiries_count integer not null default 0,
  requests_count integer not null default 0,
  suggestions_count integer not null default 0,
  unknown_count integer not null default 0,

  positive_feedback integer not null default 0,
  negative_feedback integer not null default 0,

  total_ratings integer not null default 0,
  avg_rating numeric(3,2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, date)
);
drop trigger if exists trg_daily_analytics_updated on public.daily_analytics;
create trigger trg_daily_analytics_updated before update on public.daily_analytics
  for each row execute function public.set_updated_at();
create index if not exists idx_analytics_store_date on public.daily_analytics(store_id, date desc);

-- Roll up bubble clicks into today's analytics row
create or replace function public.rollup_bubble_click()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.daily_analytics (store_id, date, bubble_clicks)
  values (new.store_id, (new.clicked_at at time zone 'utc')::date, 1)
  on conflict (store_id, date)
  do update set bubble_clicks = public.daily_analytics.bubble_clicks + 1;
  return new;
end $$;

drop trigger if exists trg_bubble_rollup on public.bubble_clicks;
create trigger trg_bubble_rollup after insert on public.bubble_clicks
  for each row execute function public.rollup_bubble_click();

-- Roll up ratings into today's analytics row (recompute avg)
create or replace function public.rollup_rating()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  d date := (new.created_at at time zone 'utc')::date;
  new_total int;
  new_avg numeric(3,2);
begin
  select count(*), coalesce(round(avg(rating)::numeric, 2), 0)
    into new_total, new_avg
    from public.ratings
   where store_id = new.store_id
     and (created_at at time zone 'utc')::date = d;

  insert into public.daily_analytics (store_id, date, total_ratings, avg_rating)
  values (new.store_id, d, new_total, new_avg)
  on conflict (store_id, date)
  do update set total_ratings = excluded.total_ratings,
                avg_rating    = excluded.avg_rating;
  return new;
end $$;

drop trigger if exists trg_rating_rollup on public.ratings;
create trigger trg_rating_rollup after insert on public.ratings
  for each row execute function public.rollup_rating();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.user_roles      enable row level security;
alter table public.stores          enable row level security;
alter table public.store_members   enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.tickets         enable row level security;
alter table public.ratings         enable row level security;
alter table public.insights        enable row level security;
alter table public.bubble_clicks   enable row level security;
alter table public.daily_analytics enable row level security;

-- Helper: drop-and-create policies idempotently
-- profiles
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);

-- user_roles (read your own; only admins can mutate)
drop policy if exists "user_roles self read"  on public.user_roles;
drop policy if exists "user_roles admin all"  on public.user_roles;
create policy "user_roles self read" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles admin all" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- stores
drop policy if exists "stores member read"   on public.stores;
drop policy if exists "stores owner write"   on public.stores;
drop policy if exists "stores owner update"  on public.stores;
drop policy if exists "stores owner delete"  on public.stores;
create policy "stores member read"  on public.stores for select using (public.is_store_member(auth.uid(), id));
create policy "stores owner write"  on public.stores for insert with check (auth.uid() = owner_id);
create policy "stores owner update" on public.stores for update using (auth.uid() = owner_id);
create policy "stores owner delete" on public.stores for delete using (auth.uid() = owner_id);

-- store_members
drop policy if exists "members read"  on public.store_members;
drop policy if exists "members write" on public.store_members;
create policy "members read"  on public.store_members for select using (public.is_store_member(auth.uid(), store_id));
create policy "members write" on public.store_members for all
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Generic store-scoped policies macro (manual repetition since plpgsql DO can't create policies cleanly with vars)
-- conversations
drop policy if exists "conv member all" on public.conversations;
create policy "conv member all" on public.conversations for all
  using (public.is_store_member(auth.uid(), store_id))
  with check (public.is_store_member(auth.uid(), store_id));

-- messages (scoped via parent conversation)
drop policy if exists "msg member all" on public.messages;
create policy "msg member all" on public.messages for all
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and public.is_store_member(auth.uid(), c.store_id)
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and public.is_store_member(auth.uid(), c.store_id)
  ));

-- tickets
drop policy if exists "tickets member all" on public.tickets;
create policy "tickets member all" on public.tickets for all
  using (public.is_store_member(auth.uid(), store_id))
  with check (public.is_store_member(auth.uid(), store_id));

-- ratings
drop policy if exists "ratings member all" on public.ratings;
create policy "ratings member all" on public.ratings for all
  using (public.is_store_member(auth.uid(), store_id))
  with check (public.is_store_member(auth.uid(), store_id));

-- insights
drop policy if exists "insights member all" on public.insights;
create policy "insights member all" on public.insights for all
  using (public.is_store_member(auth.uid(), store_id))
  with check (public.is_store_member(auth.uid(), store_id));

-- bubble_clicks (anon insert allowed, member read)
drop policy if exists "bubble member read"  on public.bubble_clicks;
drop policy if exists "bubble anon insert"  on public.bubble_clicks;
create policy "bubble member read" on public.bubble_clicks for select using (public.is_store_member(auth.uid(), store_id));
create policy "bubble anon insert" on public.bubble_clicks for insert with check (true);

-- daily_analytics
drop policy if exists "analytics member read" on public.daily_analytics;
create policy "analytics member read" on public.daily_analytics for select using (public.is_store_member(auth.uid(), store_id));
