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
