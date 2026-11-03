-- Aggregate leaderboard data for arbitrary date ranges without exposing closing rows.
create or replace function public.period_leaderboard(
  period_start date,
  period_end date
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
    and c.closing_date >= period_start
    and c.closing_date <= period_end
  where p.role = 'staff'
  group by p.id, p.full_name, p.avatar_path
  order by 4 desc, p.full_name;
$$;

revoke execute on function public.period_leaderboard(date, date) from public, anon;
grant execute on function public.period_leaderboard(date, date) to authenticated;
