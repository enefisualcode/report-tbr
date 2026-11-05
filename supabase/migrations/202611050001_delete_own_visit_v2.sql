-- Endpoint penghapusan versi baru dengan hasil terstruktur agar klien dapat
-- membedakan penghapusan yang berhasil dari request yang tidak mengubah data.
create or replace function public.delete_my_visit_v2(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_visit record;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak valid.';
  end if;

  delete from public.visits
  where id = target_id
    and user_id = auth.uid()
  returning id, photo_path into deleted_visit;

  if deleted_visit.id is null then
    raise exception 'Dokumentasi tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'id', deleted_visit.id,
    'photo_path', deleted_visit.photo_path
  );
end;
$$;

revoke all on function public.delete_my_visit_v2(uuid) from public, anon;
grant execute on function public.delete_my_visit_v2(uuid) to authenticated;
