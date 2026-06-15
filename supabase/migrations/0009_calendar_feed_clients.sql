-- Let clients subscribe to a feed of their OWN confirmed appointments, while the
-- admin's token still returns the whole schedule. Every profile already has a
-- calendar_token (default from 0008), so the only change is making the function
-- role-aware: an admin token → all confirmed appointments; a client token →
-- only the appointments where they are the client.

create or replace function public.calendar_feed(p_token uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  service_name text,
  customer text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    s.name as service_name,
    coalesce(p.full_name, a.customer_name, 'Walk-in') as customer
  from public.profiles owner
  join public.appointments a
    on owner.role = 'admin' or a.client_id = owner.id
  join public.services s on s.id = a.service_id
  left join public.profiles p on p.id = a.client_id
  where owner.calendar_token = p_token
    and a.status = 'confirmed'
    and a.starts_at >= now() - interval '30 days'
  order by a.starts_at;
$$;
