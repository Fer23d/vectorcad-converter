create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  surname text,
  company text,
  company_id uuid references public.companies(id) on delete set null,
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  terms_version text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_company_idx
  on public.profiles (company);

create index if not exists profiles_company_id_idx
  on public.profiles (company_id);

create index if not exists profiles_user_id_idx
  on public.profiles (user_id);

create index if not exists profiles_terms_accepted_idx
  on public.profiles (terms_accepted);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, surname, company, terms_accepted, terms_accepted_at, terms_version)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'company', ''),
    case when lower(coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false')) = 'true' then true else false end,
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    nullif(new.raw_user_meta_data ->> 'terms_version', '')
  )
  on conflict (user_id) do update
    set name = coalesce(excluded.name, public.profiles.name),
        surname = coalesce(excluded.surname, public.profiles.surname),
        company = coalesce(excluded.company, public.profiles.company),
        terms_accepted = excluded.terms_accepted,
        terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
        terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();
