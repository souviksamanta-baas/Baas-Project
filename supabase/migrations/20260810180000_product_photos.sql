-- Product photos: column + public storage bucket for org members.

alter table public.products
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {organization_id}/{product_id}/photo.{ext}
drop policy if exists product_photos_public_read on storage.objects;
create policy product_photos_public_read
on storage.objects
for select
to public
using (bucket_id = 'product-photos');

drop policy if exists product_photos_member_insert on storage.objects;
create policy product_photos_member_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
);

drop policy if exists product_photos_member_update on storage.objects;
create policy product_photos_member_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
)
with check (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
);

drop policy if exists product_photos_member_delete on storage.objects;
create policy product_photos_member_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-photos'
  and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
);
