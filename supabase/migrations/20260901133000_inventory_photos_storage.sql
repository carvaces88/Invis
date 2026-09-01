-- Public bucket for inventory album photos (cross-device sync via workspace snapshots).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-photos',
  'inventory-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Inventory photos public read" on storage.objects;
create policy "Inventory photos public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'inventory-photos');

drop policy if exists "Inventory photos public insert" on storage.objects;
create policy "Inventory photos public insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'inventory-photos');

drop policy if exists "Inventory photos public update" on storage.objects;
create policy "Inventory photos public update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'inventory-photos')
  with check (bucket_id = 'inventory-photos');
