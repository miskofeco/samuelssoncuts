-- Service images live in a public Storage bucket `service-images`. Public read
-- so next/image can load them without signed URLs; writes are restricted to
-- admins (profiles.role = 'admin') via RLS on storage.objects.

insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do nothing;

-- Anyone may read service images (bucket is public).
create policy "service_images public read"
on storage.objects for select
using (bucket_id = 'service-images');

-- Only admins may upload service images.
create policy "service_images admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Only admins may overwrite service images.
create policy "service_images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Only admins may delete service images.
create policy "service_images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'service-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
