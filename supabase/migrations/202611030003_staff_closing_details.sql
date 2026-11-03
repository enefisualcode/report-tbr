-- Allow authenticated staff to learn from each other's work without exposing
-- notes or customer/account details.
create or replace function public.staff_closing_details(
  target_user_id uuid,
  period_start date,
  period_end date
)
returns table(closing_date date, product text, activity text, quantity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.closing_date, c.product, c.activity, c.quantity
  from public.closings c
  join public.profiles p on p.id = c.user_id
  where c.user_id = target_user_id
    and p.role = 'staff'
    and c.closing_date >= period_start
    and c.closing_date <= period_end
  order by c.closing_date desc, c.created_at desc;
$$;

revoke execute on function public.staff_closing_details(uuid, date, date) from public, anon;
grant execute on function public.staff_closing_details(uuid, date, date) to authenticated;
