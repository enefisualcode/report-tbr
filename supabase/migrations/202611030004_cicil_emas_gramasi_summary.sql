-- For Cicil Emas, the product summary represents gramasi rather than the
-- number of input rows. The first activity value stores the gramasi.
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
        coalesce(nullif(regexp_replace(split_part(c.activity, ' · ', 1), '[^0-9.]', '', 'g'), ''), '0')::numeric
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
