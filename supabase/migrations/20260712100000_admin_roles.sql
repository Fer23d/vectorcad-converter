alter table public.profiles
  add column if not exists admin_role text not null default 'USER';

alter table public.profiles
  drop constraint if exists profiles_admin_role_check;

alter table public.profiles
  add constraint profiles_admin_role_check
  check (admin_role in ('SUPER_ADMIN', 'ADMIN', 'USER'));

create index if not exists profiles_admin_role_idx
  on public.profiles (admin_role);

alter table public.users
  add column if not exists admin_role text not null default 'USER';

alter table public.users
  drop constraint if exists users_admin_role_check;

alter table public.users
  add constraint users_admin_role_check
  check (admin_role in ('SUPER_ADMIN', 'ADMIN', 'USER'));

create index if not exists users_admin_role_idx
  on public.users (admin_role);
