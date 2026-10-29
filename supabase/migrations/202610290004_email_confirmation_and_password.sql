alter table public.profiles
  add column if not exists contact_email text unique;

update public.profiles p
set contact_email = u.email
from auth.users u
where u.id = p.id
  and p.contact_email is null;

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
  insert into public.profiles(id, full_name, nip, contact_email, role, requested_role)
  values(
    new.id,
    coalesce(supplied_name, supplied_nip, split_part(new.email, '@', 1), 'Staff'),
    supplied_nip,
    new.email,
    supplied_role,
    supplied_role
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    nip = coalesce(public.profiles.nip, excluded.nip),
    contact_email = excluded.contact_email,
    role = excluded.role,
    requested_role = excluded.requested_role;
  return new;
end;
$$;

create or replace function public.login_email_by_nip(input_nip text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where upper(p.nip) = upper(trim(input_nip))
  limit 1;
$$;

revoke all on function public.login_email_by_nip(text) from public;
grant execute on function public.login_email_by_nip(text) to anon, authenticated;
