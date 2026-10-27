create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'::public.user_role);
$$;

create or replace function public.approve_supervisor(target_user_id uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare approved public.profiles;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat menyetujui akses supervisor'; end if;
  update public.profiles set role = 'supervisor', requested_role = 'supervisor'
  where id = target_user_id and requested_role = 'supervisor' returning * into approved;
  if approved.id is null then raise exception 'User tidak ditemukan atau tidak memiliki permintaan supervisor'; end if;
  return approved;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.approve_supervisor(uuid) from public, anon;
grant execute on function public.approve_supervisor(uuid) to authenticated;

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());
