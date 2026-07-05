create table if not exists public.companies_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  plan_grant text not null default 'pro' check (plan_grant in ('free', 'plus', 'pro', 'empresarial', 'enterprise')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_name)
);

create index if not exists companies_users_user_id_idx
  on public.companies_users (user_id);

create index if not exists companies_users_company_name_idx
  on public.companies_users (company_name);

alter table public.companies_users enable row level security;

drop policy if exists "Users can read their own company memberships" on public.companies_users;
create policy "Users can read their own company memberships"
  on public.companies_users
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage company memberships" on public.companies_users;
create policy "Service role can manage company memberships"
  on public.companies_users
  for all
  to service_role
  using (true)
  with check (true);
