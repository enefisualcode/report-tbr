alter table public.profiles
  add column if not exists avatar_path text;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff upload own profile photo" on storage.objects;
drop policy if exists "staff read own profile photo" on storage.objects;
drop policy if exists "staff update own profile photo" on storage.objects;
drop policy if exists "staff delete own profile photo" on storage.objects;

create policy "staff upload own profile photo"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff read own profile photo"
on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff update own profile photo"
on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "staff delete own profile photo"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_my_avatar_path(target_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_path is not null
    and split_part(target_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid avatar path';
  end if;

  update public.profiles
  set avatar_path = nullif(trim(target_path), '')
  where id = auth.uid();
end;
$$;

revoke execute on function public.set_my_avatar_path(text) from public, anon;
grant execute on function public.set_my_avatar_path(text) to authenticated;
