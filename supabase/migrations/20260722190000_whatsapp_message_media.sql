-- WhatsApp image media: columns on conversation_messages + private storage bucket.

alter table public.conversation_messages
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists media_storage_path text,
  add column if not exists media_url text;

create index if not exists conversation_messages_media_id_idx
on public.conversation_messages (media_id)
where media_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {organization_id}/{business_center_id}/{conversation_id}/{filename}
drop policy if exists whatsapp_media_member_read on storage.objects;
create policy whatsapp_media_member_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'whatsapp-media'
  and (storage.foldername(name))[1]::uuid in (select private.user_org_ids())
);
