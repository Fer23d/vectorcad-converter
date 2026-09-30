-- Admin user access management.
-- Blocked users keep their account/data, but server-side checks deny access.
alter table public.profiles
  add column if not exists status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'blocked'));

create index if not exists profiles_status_idx
  on public.profiles (status);

alter table public.users
  add column if not exists status text not null default 'active';

alter table public.users
  drop constraint if exists users_status_check;

alter table public.users
  add constraint users_status_check check (status in ('active', 'blocked'));

create index if not exists users_status_idx
  on public.users (status);

-- Preserve administrative audit history even if an administrator account is
-- permanently deleted later. Operation target ids are already stored as text.
alter table public.admin_logs
  alter column admin_id drop not null;

alter table public.admin_logs
  drop constraint if exists admin_logs_admin_id_fkey;

alter table public.admin_logs
  add constraint admin_logs_admin_id_fkey
  foreign key (admin_id) references auth.users(id) on delete set null;
