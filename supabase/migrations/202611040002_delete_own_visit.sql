-- Hapus dokumentasi melalui fungsi terkontrol agar validasi kepemilikan
-- selalu konsisten pada database dan klien mendapat respons yang tegas.
create or replace function public.delete_my_visit(target_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_photo_path text;
begin
  delete from public.visits
  where id = target_id and user_id = auth.uid()
  returning photo_path into deleted_photo_path;

  if not found then
    raise exception 'Dokumentasi tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.';
  end if;

  return deleted_photo_path;
end;
$$;

revoke all on function public.delete_my_visit(uuid) from public, anon;
grant execute on function public.delete_my_visit(uuid) to authenticated;
