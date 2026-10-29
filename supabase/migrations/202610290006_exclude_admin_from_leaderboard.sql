-- The leaderboard is a staff performance view. Admin accounts must never
-- appear in it, even when they have no closing data.
drop function if exists public.monthly_leaderboard(date);

create function public.monthly_leaderboard(
  month_start date default date_trunc('month', current_date)::date
)
returns table(user_id uuid, full_name text, avatar_path text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.full_name,
    p.avatar_path,
    coalesce(sum(c.quantity), 0)::bigint as total
  from public.profiles p
  left join public.closings c
    on c.user_id = p.id
    and c.closing_date >= month_start
    and c.closing_date < (month_start + interval '1 month')
  where p.role = 'staff'
  group by p.id, p.full_name, p.avatar_path
  order by 4 desc, p.full_name;
$$;

revoke execute on function public.monthly_leaderboard(date) from public, anon;
grant execute on function public.monthly_leaderboard(date) to authenticated;
