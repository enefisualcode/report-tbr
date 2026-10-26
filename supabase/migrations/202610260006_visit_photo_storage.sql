insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'visit-photos',
  'visit-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff upload own visit photo" on storage.objects;
drop policy if exists "staff read own visit photo or supervisor all" on storage.objects;
drop policy if exists "staff delete own visit photo" on storage.objects;

create policy "staff upload own visit photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'visit-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "staff read own visit photo or supervisor all"
on storage.objects for select to authenticated
using (
  bucket_id = 'visit-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_supervisor()
  )
);

create policy "staff delete own visit photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'visit-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
