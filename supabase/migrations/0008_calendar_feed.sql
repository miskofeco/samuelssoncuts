-- Calendar export: a live subscription feed that calendar apps (Google, Apple,
-- …) poll with no logged-in session. Each barber gets a secret token; the feed
-- URL embeds it. A SECURITY DEFINER function returns that barber's confirmed
-- appointments, bypassing RLS for the tokenized request only (same pattern as
-- phone_taken in 0007). Rotating the token invalidates old feed URLs.

alter table public.profiles
  add column if not exists calendar_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_calendar_token_idx
  on public.profiles (calendar_token);

-- Returns confirmed appointments from 30 days ago onward (a rolling window so
-- subscribers keep a little history but the feed stays small). Joins service
-- name and the customer label (registered client's name or walk-in name).
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
  from public.appointments a
  join public.profiles owner on owner.calendar_token = p_token
  join public.services s on s.id = a.service_id
  left join public.profiles p on p.id = a.client_id
  where a.status = 'confirmed'
    and a.starts_at >= now() - interval '30 days'
  order by a.starts_at;
$$;

grant execute on function public.calendar_feed(uuid) to anon, authenticated;
