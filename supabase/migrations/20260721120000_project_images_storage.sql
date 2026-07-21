insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do update set public = excluded.public;

create policy "Project owners can upload project images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);

create policy "Project owners can update project images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);

create policy "Project owners can delete project images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);
