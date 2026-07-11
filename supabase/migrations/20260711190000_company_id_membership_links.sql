alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists profiles_company_id_idx
  on public.profiles (company_id);

alter table public.users
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists users_company_id_idx
  on public.users (company_id);
