alter table public.profiles
  add column if not exists nip text unique,
  add column if not exists requested_role public.user_role not null default 'staff';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_nip text := nullif(trim(new.raw_user_meta_data ->> 'nip'), '');
  supplied_role public.user_role := case
    when new.raw_user_meta_data ->> 'requested_role' = 'supervisor' then 'supervisor'::public.user_role
    else 'staff'::public.user_role
  end;
begin
  insert into public.profiles(id, full_name, nip, requested_role)
  values(
    new.id,
    coalesce(supplied_nip, split_part(new.email, '@', 1), 'Staff'),
    supplied_nip,
    supplied_role
  )
  on conflict (id) do update set
    nip = coalesce(public.profiles.nip, excluded.nip),
    requested_role = excluded.requested_role;
  return new;
end;
$$;

comment on column public.profiles.requested_role is
  'Jabatan yang dipilih saat pendaftaran. Role efektif tetap staff sampai disetujui admin.';
