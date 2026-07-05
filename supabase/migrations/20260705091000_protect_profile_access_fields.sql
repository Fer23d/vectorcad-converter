create or replace function public.prevent_client_profile_access_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normal authenticated users can edit personal profile fields only.
  -- Billing/admin controlled fields must be changed by service_role APIs.
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.company is distinct from old.company
      or new.plan is distinct from old.plan
      or new.is_premium is distinct from old.is_premium
      or new.payment_status is distinct from old.payment_status
      or new.usage_count_today is distinct from old.usage_count_today
      or new.export3d_count_today is distinct from old.export3d_count_today
      or new.last_usage_reset is distinct from old.last_usage_reset then
      raise exception 'Protected profile fields can only be updated by admin or billing backend.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_profile_access_changes on public.profiles;
create trigger prevent_client_profile_access_changes
  before update on public.profiles
  for each row execute function public.prevent_client_profile_access_changes();
