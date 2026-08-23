-- Server-side authentication and security audit events.
create table if not exists public.auth_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  success boolean not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists auth_security_events_user_id_idx
  on public.auth_security_events (user_id, created_at desc);

create index if not exists auth_security_events_type_idx
  on public.auth_security_events (event_type, created_at desc);

alter table public.auth_security_events enable row level security;

drop policy if exists "Service role can insert auth security events" on public.auth_security_events;
create policy "Service role can insert auth security events"
  on public.auth_security_events for insert to service_role
  with check (true);

drop policy if exists "Service role can read auth security events" on public.auth_security_events;
create policy "Service role can read auth security events"
  on public.auth_security_events for select to service_role
  using (true);
