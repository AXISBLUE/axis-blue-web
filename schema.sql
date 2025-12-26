-- AXIS BLUE minimal schema (public)
-- Run in Supabase SQL editor

create table if not exists public.days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merch_name text not null,
  day_date date not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_id uuid not null references public.days(id) on delete cascade,
  store_code text not null,
  store_name text not null,
  store_address text not null,
  note text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_id uuid not null references public.days(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  type text not null,
  item text not null,
  qty int,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_id uuid not null references public.days(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  category text not null,
  label text,
  detected_code text,
  nfc_payload text,
  photo_data_url text not null,
  created_at timestamptz not null default now()
);

-- RLS ON (recommended). Keep simple for now: user can only see their rows.
alter table public.days enable row level security;
alter table public.visits enable row level security;
alter table public.issues enable row level security;
alter table public.captures enable row level security;

-- policies
drop policy if exists "days_own" on public.days;
create policy "days_own" on public.days
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "visits_own" on public.visits;
create policy "visits_own" on public.visits
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "issues_own" on public.issues;
create policy "issues_own" on public.issues
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "captures_own" on public.captures;
create policy "captures_own" on public.captures
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
