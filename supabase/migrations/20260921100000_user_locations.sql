create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ip_address text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

create index if not exists user_locations_user_id_idx
  on public.user_locations (user_id);

create index if not exists user_locations_created_at_idx
  on public.user_locations (created_at desc);

create unique index if not exists user_locations_user_daily_idx
  on public.user_locations (user_id, ((created_at at time zone 'utc')::date))
  where user_id is not null;

create unique index if not exists user_locations_ip_daily_idx
  on public.user_locations (ip_address, ((created_at at time zone 'utc')::date))
  where user_id is null and ip_address is not null;

alter table public.user_locations enable row level security;

drop policy if exists "Users can read their own location rows" on public.user_locations;
create policy "Users can read their own location rows"
  on public.user_locations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own location rows" on public.user_locations;
create policy "Users can create their own location rows"
  on public.user_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);
