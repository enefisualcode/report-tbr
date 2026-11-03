-- Return only aggregate product totals for a staff detail modal.
-- This keeps the row-level closing data protected by RLS.
create or replace function public.staff_closing_breakdown(
  target_user_id uuid,
  period_start date,
  period_end date
)
returns table(product text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.product,
    coalesce(sum(c.quantity), 0)::bigint as total
  from public.closings c
  join public.profiles p on p.id = c.user_id
  where c.user_id = target_user_id
    and p.role = 'staff'
    and c.closing_date >= period_start
    and c.closing_date <= period_end
  group by c.product
  order by c.product;
$$;

revoke execute on function public.staff_closing_breakdown(uuid, date, date) from public, anon;
grant execute on function public.staff_closing_breakdown(uuid, date, date) to authenticated;
