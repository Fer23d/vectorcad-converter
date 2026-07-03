create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro', 'empresarial', 'enterprise')),
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
