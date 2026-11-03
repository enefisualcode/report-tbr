-- Read the first numeric value from activity so both old and new Cicil Emas
-- records contribute their gramasi to the product summary.
drop function if exists public.staff_closing_breakdown(uuid, date, date);

create function public.staff_closing_breakdown(
  target_user_id uuid,
  period_start date,
  period_end date
)
returns table(product text, total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.product,
    sum(case
      when c.product = 'Cicil Emas' then
        coalesce((regexp_match(c.activity, '([0-9]+(?:[.][0-9]+)?)'))[1], '0')::numeric
      else c.quantity::numeric
    end) as total
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
