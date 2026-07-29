-- Security hardening: server-managed admin roles, private project images and webhook replay protection.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'USER' check (role in ('USER', 'ADMIN')),
  created_at timestamptz not null default now()
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
alter table public.user_roles enable row level security;

drop policy if exists "Service role can manage user roles" on public.user_roles;
create policy "Service role can manage user roles"
  on public.user_roles for all to service_role
  using (true) with check (true);

-- No authenticated-user policy is intentional: role decisions are server-side only.

update storage.buckets
set public = false
where id = 'project-images';

drop policy if exists "Project owners can read project images" on storage.objects;
create policy "Project owners can read project images"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);

create table if not exists public.payment_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.payment_webhook_events enable row level security;
drop policy if exists "No client access to payment webhook events" on public.payment_webhook_events;
create policy "No client access to payment webhook events"
  on public.payment_webhook_events for all
  using (false) with check (false);
