-- Atomically claims a usage unit so concurrent requests cannot bypass daily limits.
create or replace function public.consume_usage(
  p_user_id uuid,
  p_action text,
  p_usage_limit integer,
  p_export3d_limit integer
)
returns table(allowed boolean, usage_count integer, export3d_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_usage integer;
  current_export3d integer;
  last_reset timestamptz;
begin
  select usage_count_today, export3d_count_today, last_usage_reset
    into current_usage, current_export3d, last_reset
    from public.profiles
   where user_id = p_user_id
   for update;

  if not found then
    insert into public.profiles (user_id, usage_count_today, export3d_count_today, last_usage_reset)
    values (p_user_id, 0, 0, now())
    on conflict (user_id) do nothing;
    current_usage := 0;
    current_export3d := 0;
    last_reset := now();
  end if;

  if last_reset is null or last_reset::date <> now()::date then
    current_usage := 0;
    current_export3d := 0;
  end if;

  if p_action in ('vectorize', 'export_svg', 'export_png')
     and p_usage_limit is not null and current_usage >= p_usage_limit then
    return query select false, current_usage, current_export3d;
    return;
  end if;

  if p_action = 'export3d'
     and p_export3d_limit is not null and current_export3d >= p_export3d_limit then
    return query select false, current_usage, current_export3d;
    return;
  end if;

  if p_action in ('vectorize', 'export_svg', 'export_png') then current_usage := current_usage + 1; end if;
  if p_action = 'export3d' then current_export3d := current_export3d + 1; end if;

  update public.profiles
     set usage_count_today = current_usage,
         export3d_count_today = current_export3d,
         last_usage_reset = now(),
         updated_at = now()
   where user_id = p_user_id;

  return query select true, current_usage, current_export3d;
end;
$$;

revoke all on function public.consume_usage(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_usage(uuid, text, integer, integer) to service_role;
