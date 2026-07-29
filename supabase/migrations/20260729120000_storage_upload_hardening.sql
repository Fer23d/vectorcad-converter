-- Enforce private project images and constrain client-managed object paths.
update storage.buckets
set public = false,
    file_size_limit = 31457280,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/tiff']::text[]
where id = 'project-images';

drop policy if exists "Project owners can upload project images" on storage.objects;
create policy "Project owners can upload project images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-images'
  and array_length(storage.foldername(name), 1) = 1
  and storage.extension(name) in ('png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff')
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Project owners can update project images" on storage.objects;
create policy "Project owners can update project images"
on storage.objects for update to authenticated
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
  and array_length(storage.foldername(name), 1) = 1
  and storage.extension(name) in ('png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff')
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
  )
);

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
