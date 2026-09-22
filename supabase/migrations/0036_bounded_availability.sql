-- Keep the legacy zero-argument RPC for existing deployments, but let current
-- booking clients request only the window they can actually display. Explicit
-- bounds keep future appointments from accumulating in every page payload.
create function public.confirmed_appointment_slots_window(
  p_from timestamptz,
  p_to timestamptz
)
returns table (id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.service_id, a.starts_at, a.ends_at
  from public.appointments a
  where a.status = 'confirmed'
    and a.starts_at < p_to
    and a.ends_at > p_from
    and p_to > p_from
    and p_to <= p_from + interval '32 days'
    and exists (
      select 1 from public.profiles barber
      where barber.id = a.barber_id and barber.is_shop_barber
    )
  order by a.starts_at;
$$;
revoke execute on function public.confirmed_appointment_slots_window(timestamptz, timestamptz) from public, anon;
grant execute on function public.confirmed_appointment_slots_window(timestamptz, timestamptz) to authenticated;

-- Range overlap searches for booking/availability are otherwise a growing
-- table scan. GiST supports both the bounded loader and overlap guard.
create index if not exists blocked_times_barber_range_idx
  on public.blocked_times using gist (barber_id, tstzrange(starts_at, ends_at, '[)'));
