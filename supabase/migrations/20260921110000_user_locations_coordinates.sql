alter table public.user_locations
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

create index if not exists user_locations_coordinates_idx
  on public.user_locations (latitude, longitude)
  where latitude is not null and longitude is not null;
