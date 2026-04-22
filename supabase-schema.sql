-- DevToolbox: user state persistence table
-- Run this in your Supabase project's SQL editor

create table if not exists public.user_states (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  state    jsonb    not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security so each user can only access their own row
alter table public.user_states enable row level security;

create policy "Users can read their own state"
  on public.user_states
  for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own state"
  on public.user_states
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own state"
  on public.user_states
  for update
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Login events table (for admin analytics)
-- ─────────────────────────────────────────────
create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.login_events enable row level security;

create policy "Users can insert their own login events"
  on public.login_events
  for insert
  with check (auth.uid() = user_id);

create policy "Admins can read all login events"
  on public.login_events
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─────────────────────────────────────────────
-- RPC: get_login_stats — returns daily & monthly login counts.
-- Runs as the table owner (SECURITY DEFINER) so it can bypass RLS
-- and aggregate across all users. Access is still gated: only JWTs
-- with app_metadata.role = 'admin' may call it.
-- ─────────────────────────────────────────────
create or replace function get_login_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  daily_count  bigint;
  monthly_count bigint;
begin
  -- Gate: only admins may call this function
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') into caller_role;
  if caller_role <> 'admin' then
    raise exception 'Access denied';
  end if;

  select count(*) into daily_count
  from public.login_events
  where created_at >= current_date;

  select count(*) into monthly_count
  from public.login_events
  where created_at >= date_trunc('month', now());

  return json_build_object(
    'daily',   daily_count,
    'monthly', monthly_count
  );
end;
$$;
