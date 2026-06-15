-- Profile pictures live in a public Storage bucket `avatars`. Public read so
-- <img>/next/image can load them without signed URLs; writes are restricted to
-- each user's own folder (avatars/{auth.uid()}/…) via RLS on storage.objects.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone may read avatars (the bucket is public).
create policy "avatars public read"
on storage.objects for select
using (bucket_id = 'avatars');

-- A signed-in user may upload only into their own folder: the first path
-- segment must equal their user id (avatars/{uid}/avatar.<ext>).
create policy "avatars owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Overwrite their own photo (upsert).
create policy "avatars owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete their own photo (revert to initials).
create policy "avatars owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
