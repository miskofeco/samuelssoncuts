-- Client self-service over confirmed appointments + notification read-state.
--
-- 1. notifications.read_at powers the in-app notification center's unread badge.
-- 2. Two SECURITY DEFINER RPCs let a client cancel or reschedule a *confirmed*
--    appointment. Under the current RLS a client can only read appointments, not
--    mutate them, so these mirror the transactional pattern established in 0017
--    (confirm_booking_request / respond_to_appointment_proposal): verify the
--    caller owns the row, enforce a 24h lead-time in SQL as defense-in-depth,
--    and keep booking_requests in sync.
--
-- Business-hours / blocked-time validation stays in the action layer (as with
-- confirm_booking_request, which trusts the app + client picker for hours) — the
-- barber also re-confirms a rescheduled request before it becomes an appointment.

-- ---------------------------------------------------------------------------
-- 1. Notification read-state
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists read_at timestamptz;

-- Owners may mark their own notifications read. The existing SELECT policy only
-- exposes rows where user_id = auth.uid() to clients, so this scope matches
-- exactly what the client can see (recipient-only rows are already invisible).
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2a. Cancel a confirmed appointment (client-initiated, >24h out)
-- ---------------------------------------------------------------------------
create or replace function public.client_cancel_confirmed_appointment(
  p_appointment_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
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
    raise exception 'appointment is not cancellable' using errcode = 'P0001';
  end if;

  -- 24h lead-time backstop (the action enforces the same for a friendly message).
  if v_appt.starts_at <= now() + interval '24 hours' then
    raise exception 'too late to cancel' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      outcome = 'cancelled'
  where id = v_appt.id;

  -- Keep the originating request in sync so it leaves the client's active list.
  if v_appt.request_id is not null then
    update public.booking_requests
    set status = 'cancelled',
        updated_at = now()
    where id = v_appt.request_id;
  end if;

  return v_appt.request_id;
end;
$$;

grant execute on function public.client_cancel_confirmed_appointment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Request a reschedule of a confirmed appointment (client-initiated, >24h)
--
-- Releases the current slot and re-opens the originating request as a pending
-- exact-slot request at the new time, so it re-enters the barber's normal
-- one-click confirm queue (confirm_booking_request). The appointment's own
-- duration is preserved. Returns the request id.
-- ---------------------------------------------------------------------------
create or replace function public.client_request_reschedule(
  p_appointment_id uuid,
  p_new_start timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
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

  -- Both the existing appointment and the requested new time must be >24h out.
  if v_appt.starts_at <= now() + interval '24 hours'
     or p_new_start <= now() + interval '24 hours' then
    raise exception 'too late to reschedule' using errcode = 'P0001';
  end if;

  v_duration := v_appt.ends_at - v_appt.starts_at;
  v_new_end := p_new_start + v_duration;

  -- Slot must be free (ignore this appointment, which we're about to release).
  if public.has_confirmed_appointment_overlap(
       v_appt.barber_id, p_new_start, v_new_end, v_appt.id
     ) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  -- Release the current slot.
  update public.appointments
  set status = 'cancelled',
      outcome = 'cancelled'
  where id = v_appt.id;

  -- Re-open the originating request at the new time for barber confirmation.
  update public.booking_requests
  set requested_start = p_new_start,
      requested_end = v_new_end,
      status = 'pending',
      updated_at = now()
  where id = v_appt.request_id;

  return v_appt.request_id;
end;
$$;

grant execute on function public.client_request_reschedule(uuid, timestamptz) to authenticated;
