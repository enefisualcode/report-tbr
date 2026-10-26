create extension if not exists pgcrypto;

create type public.user_role as enum ('staff', 'supervisor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Staff',
  role public.user_role not null default 'staff',
  area text not null default 'Jakarta Saharjo',
  created_at timestamptz not null default now()
);

create table public.closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  closing_date date not null default current_date,
  product text not null,
  activity text not null,
  quantity integer not null check (quantity between 1 and 100),
  notes text,
  created_at timestamptz not null default now()
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  visit_date date not null default current_date,
  notes text not null,
  photo_path text,
  created_at timestamptz not null default now()
);

create index closings_user_date_idx on public.closings(user_id, closing_date desc);
create index visits_user_date_idx on public.visits(user_id, visit_date desc);

create or replace function public.is_supervisor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'supervisor');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles(id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Staff')
from auth.users
on conflict (id) do nothing;

create or replace function public.monthly_leaderboard(month_start date default date_trunc('month', current_date)::date)
returns table(user_id uuid, full_name text, total bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, coalesce(sum(c.quantity), 0)::bigint as total
  from public.profiles p
  left join public.closings c on c.user_id = p.id
    and c.closing_date >= month_start
    and c.closing_date < (month_start + interval '1 month')
  group by p.id, p.full_name
  order by 3 desc, p.full_name;
$$;

alter table public.profiles enable row level security;
alter table public.closings enable row level security;
alter table public.visits enable row level security;

revoke all on public.profiles, public.closings, public.visits from anon;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.closings, public.visits to authenticated;
revoke execute on function public.is_supervisor() from public, anon;
revoke execute on function public.monthly_leaderboard(date) from public, anon;
grant execute on function public.is_supervisor() to authenticated;
grant execute on function public.monthly_leaderboard(date) to authenticated;

create policy "authenticated profiles visible" on public.profiles for select to authenticated using (true);
create policy "staff read own closings or supervisor all" on public.closings for select to authenticated using (user_id = auth.uid() or public.is_supervisor());
create policy "staff insert own closings" on public.closings for insert to authenticated with check (user_id = auth.uid());
create policy "staff update own closings" on public.closings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff delete own closings" on public.closings for delete to authenticated using (user_id = auth.uid());
create policy "staff read own visits or supervisor all" on public.visits for select to authenticated using (user_id = auth.uid() or public.is_supervisor());
create policy "staff insert own visits" on public.visits for insert to authenticated with check (user_id = auth.uid());
create policy "staff update own visits" on public.visits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff delete own visits" on public.visits for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('visit-photos', 'visit-photos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "staff upload own visit photo" on storage.objects for insert to authenticated
with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "staff read own visit photo or supervisor all" on storage.objects for select to authenticated
using (bucket_id = 'visit-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_supervisor()));
create policy "staff delete own visit photo" on storage.objects for delete to authenticated
using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
