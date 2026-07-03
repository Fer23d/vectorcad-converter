create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_plan_idx
  on public.companies (plan);

alter table public.companies enable row level security;

drop policy if exists "Authenticated users can read companies" on public.companies;
create policy "Authenticated users can read companies"
  on public.companies
  for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage companies" on public.companies;
create policy "Service role can manage companies"
  on public.companies
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_logs_created_at_idx
  on public.admin_logs (created_at desc);

create index if not exists admin_logs_target_idx
  on public.admin_logs (target_type, target_id);

alter table public.admin_logs enable row level security;

drop policy if exists "No client access to admin logs" on public.admin_logs;
create policy "No client access to admin logs"
  on public.admin_logs
  for all
  using (false)
  with check (false);
