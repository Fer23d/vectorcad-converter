alter table public.profiles
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

create index if not exists profiles_terms_accepted_idx
  on public.profiles (terms_accepted);

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
