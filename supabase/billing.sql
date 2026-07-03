alter table public.profiles
  add column if not exists plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  add column if not exists is_premium boolean not null default false,
  add column if not exists payment_status text not null default 'none',
  add column if not exists mercado_pago_preapproval_id text,
  add column if not exists premium_until timestamptz;

create index if not exists profiles_plan_idx
  on public.profiles (plan);

create index if not exists profiles_payment_status_idx
  on public.profiles (payment_status);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active',
  payment_provider text default 'mercadopago',
  external_id text unique,
  amount numeric(10,2) not null default 29.00,
  currency text not null default 'BRL',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists payment_provider text default 'mercadopago',
  add column if not exists external_id text,
  add column if not exists amount numeric(10,2) not null default 29.00,
  add column if not exists currency text not null default 'BRL',
  add column if not exists raw jsonb not null default '{}'::jsonb;

alter table public.subscriptions
  alter column status set default 'active';

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id, updated_at desc);

create unique index if not exists subscriptions_external_id_idx
  on public.subscriptions (external_id)
  where external_id is not null;

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscriptions" on public.subscriptions;
create policy "Users can read their own subscriptions"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage subscriptions" on public.subscriptions;
create policy "Service role can manage subscriptions"
  on public.subscriptions
  for all
  to service_role
  using (true)
  with check (true);
