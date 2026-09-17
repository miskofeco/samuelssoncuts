-- A client reschedule re-opens the request at a new time but kept the price
-- captured at the original booking, so a client could book a base-price
-- opening slot and then move it into a VIP evening slot (or a gap-surcharge
-- slot) for free. The action now recomputes the quote server-side with the
-- same helper as a fresh booking and hands it to the RPC, which stores it on
-- the re-opened request. Replaces the 2-argument version from 0020 (dropped so
-- PostgREST never sees an ambiguous overload).

drop function if exists public.client_request_reschedule(uuid, timestamptz);

create or replace function public.client_request_reschedule(
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_price_cents integer default null,
  p_surcharge boolean default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_duration interval;
  v_new_end timestamptz;
begin
  select *
  into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found or v_appt.client_id is null or v_appt.client_id <> auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not reschedulable' using errcode = 'P0001';
  end if;

  if v_appt.request_id is null then
    raise exception 'appointment has no request to reopen' using errcode = 'P0001';
  end if;

  if p_price_cents is not null and p_price_cents < 0 then
    raise exception 'invalid price' using errcode = 'P0001';
  end if;

  -- Both the existing appointment and the requested new time must be >24h out.
  if v_appt.starts_at <= now() + interval '24 hours'
     or p_new_start <= now() + interval '24 hours' then
    raise exception 'too late to reschedule' using errcode = 'P0001';
  end if;

  v_duration := v_appt.ends_at - v_appt.starts_at;
  v_new_end := p_new_start + v_duration;

  if public.has_confirmed_appointment_overlap(
       v_appt.barber_id, p_new_start, v_new_end, v_appt.id
     ) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      outcome = 'cancelled'
  where id = v_appt.id;

  update public.booking_requests
  set requested_start = p_new_start,
      requested_end = v_new_end,
      price_cents = coalesce(p_price_cents, price_cents),
      surcharge = coalesce(p_surcharge, surcharge),
      status = 'pending',
      updated_at = now()
  where id = v_appt.request_id;

  return v_appt.request_id;
end;
$$;

revoke execute on function public.client_request_reschedule(uuid, timestamptz, integer, boolean) from public, anon;
grant execute on function public.client_request_reschedule(uuid, timestamptz, integer, boolean) to authenticated;
