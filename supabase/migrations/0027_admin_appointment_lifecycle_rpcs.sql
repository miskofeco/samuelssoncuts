-- Admin cancellations and reschedules used to hard-delete the appointment row
-- and then patch proposals/requests in separate statements. That lost the
-- outcome history (no 'cancelled' ever appeared in analytics) and left the
-- booking half-moved when a later statement failed. Both flows now run inside
-- SECURITY DEFINER RPCs that soft-cancel the appointment (status + outcome =
-- 'cancelled') in one transaction.

-- appointments.status only ever holds 'confirmed' (default, 0001) or
-- 'cancelled' (0020 RPCs). Fail loudly if production disagrees instead of
-- silently rewriting rows.
do $$
begin
  if exists (
    select 1 from public.appointments where status not in ('confirmed', 'cancelled')
  ) then
    raise exception
      'Cannot add appointments_status_check: rows with an unexpected status exist';
  end if;
end
$$;

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled'));

-- Soft-cancel a confirmed appointment. Appointments that already ended are
-- history and are refused unless p_allow_past is set explicitly. Returns the
-- originating request id (null for walk-ins).
create or replace function public.admin_cancel_appointment(
  p_appointment_id uuid,
  p_allow_past boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not cancellable' using errcode = 'P0001';
  end if;

  if v_appt.ends_at <= now() and not coalesce(p_allow_past, false) then
    raise exception 'appointment already ended' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      outcome = 'cancelled'
  where id = v_appt.id;

  if v_appt.request_id is not null then
    update public.appointment_proposals
    set status = 'expired'
    where request_id = v_appt.request_id
      and status = 'sent';

    update public.booking_requests
    set status = 'cancelled',
        updated_at = now()
    where id = v_appt.request_id;
  end if;

  return v_appt.request_id;
end;
$$;

revoke execute on function public.admin_cancel_appointment(uuid, boolean) from public, anon;
grant execute on function public.admin_cancel_appointment(uuid, boolean) to authenticated;

-- Move a confirmed client appointment: release its slot and send the client a
-- fresh proposal for the new time in the same transaction. The request goes
-- back to 'proposed' until the client accepts. Returns the new proposal id.
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
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_new_start is null or p_new_end is null or p_new_end <= p_new_start then
    raise exception 'invalid proposal range' using errcode = 'P0001';
  end if;

  if p_new_start <= now() then
    raise exception 'proposal must be in the future' using errcode = 'P0001';
  end if;

  select *
  into v_appt
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
       v_appt.barber_id, p_new_start, p_new_end, v_appt.id
     ) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      outcome = 'cancelled'
  where id = v_appt.id;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = v_appt.request_id
    and status = 'sent';

  insert into public.appointment_proposals(request_id, barber_id, starts_at, ends_at, note)
  values (v_appt.request_id, auth.uid(), p_new_start, p_new_end, p_note)
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
