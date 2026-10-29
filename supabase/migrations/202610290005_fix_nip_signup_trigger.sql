-- Signup now uses an internal synthetic Auth email derived from the NIP.
-- Keep the legacy contact_email column for existing data, but do not make
-- new NIP registrations depend on it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_nip text := nullif(trim(new.raw_user_meta_data ->> 'nip'), '');
  supplied_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  supplied_role public.user_role := case
    when new.raw_user_meta_data ->> 'requested_role' = 'supervisor'
      then 'supervisor'::public.user_role
    else 'staff'::public.user_role
  end;
begin
  insert into public.profiles(id, full_name, nip, role, requested_role)
  values(
    new.id,
    coalesce(supplied_name, supplied_nip, split_part(new.email, '@', 1), 'Staff'),
    supplied_nip,
    supplied_role,
    supplied_role
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    nip = coalesce(public.profiles.nip, excluded.nip),
    role = excluded.role,
    requested_role = excluded.requested_role;
  return new;
end;
$$;
