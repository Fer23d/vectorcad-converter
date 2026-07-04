alter table public.users
  add column if not exists usage_count_today integer not null default 0,
  add column if not exists export3d_count_today integer not null default 0,
  add column if not exists last_usage_reset timestamptz;

alter table public.profiles
  add column if not exists usage_count_today integer not null default 0,
  add column if not exists export3d_count_today integer not null default 0,
  add column if not exists last_usage_reset timestamptz;

create index if not exists users_last_usage_reset_idx
  on public.users (last_usage_reset);

create index if not exists profiles_last_usage_reset_idx
  on public.profiles (last_usage_reset);
