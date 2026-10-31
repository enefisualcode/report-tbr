-- Supervisor perlu dapat membaca foto profil staff untuk ranking dan monitoring.
drop policy if exists "staff read own profile photo" on storage.objects;
drop policy if exists "authenticated read profile photos" on storage.objects;
drop policy if exists "staff and supervisors read profile photos" on storage.objects;

create policy "staff and supervisors read profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_supervisor()
  )
);
