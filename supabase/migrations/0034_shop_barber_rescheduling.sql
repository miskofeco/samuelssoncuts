-- Rescheduling must follow the shop barber, not the admin who clicked the
-- action or a legacy appointment's previous owner.
create or replace function public.admin_reschedule_appointment_to_proposal(
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_proposal_id uuid;
  v_shop_barber_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select id into v_shop_barber_id
  from public.profiles
  where is_shop_barber and role = 'admin' and approval_status = 'approved';
  if v_shop_barber_id is null then
    raise exception 'shop barber is not configured' using errcode = 'P0001';
  end if;

  if p_new_start is null or p_new_end is null or p_new_end <= p_new_start then
    raise exception 'invalid proposal range' using errcode = 'P0001';
  end if;

  if p_new_start <= now() then
    raise exception 'proposal must be in the future' using errcode = 'P0001';
  end if;

  select * into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not reschedulable' using errcode = 'P0001';
  end if;

  if v_appt.request_id is null or v_appt.client_id is null then
    raise exception 'walk-in appointments cannot be rescheduled by proposal' using errcode = 'P0001';
  end if;

  if public.has_confirmed_appointment_overlap(
       v_shop_barber_id, p_new_start, p_new_end, v_appt.id
     ) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled', outcome = 'cancelled'
  where id = v_appt.id;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = v_appt.request_id and status = 'sent';

  insert into public.appointment_proposals(request_id, barber_id, starts_at, ends_at, note)
  values (v_appt.request_id, v_shop_barber_id, p_new_start, p_new_end, p_note)
  returning id into v_proposal_id;

  update public.booking_requests
  set status = 'proposed',
      selected_proposal_id = v_proposal_id,
      updated_at = now()
  where id = v_appt.request_id;

  return v_proposal_id;
end;
$$;
revoke execute on function public.admin_reschedule_appointment_to_proposal(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_reschedule_appointment_to_proposal(uuid, timestamptz, timestamptz, text) to authenticated;

create or replace function public.client_request_reschedule(
  p_appointment_id uuid,
  p_client_id uuid,
  p_new_start timestamptz,
  p_price_cents integer,
  p_surcharge boolean
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
  v_shop_barber_id uuid;
begin
  -- Only the authenticated server action may invoke this RPC.
  if p_client_id is null or p_price_cents is null or p_price_cents < 0 then
    raise exception 'invalid arguments' using errcode = 'P0001';
  end if;

  select id into v_shop_barber_id
  from public.profiles
  where is_shop_barber and role = 'admin' and approval_status = 'approved';
  if v_shop_barber_id is null then
    raise exception 'shop barber is not configured' using errcode = 'P0001';
  end if;

  select * into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found or v_appt.client_id is null or v_appt.client_id <> p_client_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_client_id and role = 'client' and approval_status = 'approved'
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not reschedulable' using errcode = 'P0001';
  end if;

  if v_appt.request_id is null then
    raise exception 'appointment has no request to reopen' using errcode = 'P0001';
  end if;

  if v_appt.starts_at <= now() + interval '24 hours'
     or p_new_start <= now() + interval '24 hours' then
    raise exception 'too late to reschedule' using errcode = 'P0001';
  end if;

  v_duration := v_appt.ends_at - v_appt.starts_at;
  v_new_end := p_new_start + v_duration;

  if public.has_confirmed_appointment_overlap(v_shop_barber_id, p_new_start, v_new_end, v_appt.id) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled', outcome = 'cancelled'
  where id = v_appt.id;

  update public.booking_requests
  set requested_start = p_new_start,
      requested_end = v_new_end,
      price_cents = p_price_cents,
      surcharge = coalesce(p_surcharge, false),
      status = 'pending',
      updated_at = now()
  where id = v_appt.request_id;

  return v_appt.request_id;
end;
$$;
revoke execute on function public.client_request_reschedule(uuid, uuid, timestamptz, integer, boolean) from public, anon, authenticated;
grant execute on function public.client_request_reschedule(uuid, uuid, timestamptz, integer, boolean) to service_role;
