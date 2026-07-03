alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists is_premium boolean not null default false,
  add column if not exists payment_status text not null default 'none',
  add column if not exists mercado_pago_preapproval_id text,
  add column if not exists premium_until timestamptz,
  add column if not exists usage_count_today integer not null default 0,
  add column if not exists export3d_count_today integer not null default 0,
  add column if not exists last_usage_reset timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'plus', 'pro', 'empresarial', 'enterprise'));

create index if not exists profiles_plan_idx
  on public.profiles (plan);

create index if not exists profiles_payment_status_idx
  on public.profiles (payment_status);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro', 'empresarial', 'enterprise')),
  company text,
  is_premium boolean not null default false,
  usage_count_today integer not null default 0,
  export3d_count_today integer not null default 0,
  last_usage_reset timestamptz,
  payment_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_plan_idx
  on public.users (plan);

create index if not exists users_company_idx
  on public.users (company);

alter table public.users enable row level security;

drop policy if exists "Users can read their own billing user" on public.users;
create policy "Users can read their own billing user"
  on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "Service role can manage billing users" on public.users;
create policy "Service role can manage billing users"
  on public.users
  for all
  to service_role
  using (true)
  with check (true);

alter table public.companies
  drop constraint if exists companies_plan_check;

alter table public.companies
  add constraint companies_plan_check check (plan in ('free', 'plus', 'pro', 'empresarial', 'enterprise'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check check (plan in ('free', 'plus', 'pro', 'empresarial', 'enterprise'));

alter table public.subscriptions
  alter column amount set default 25.90;
