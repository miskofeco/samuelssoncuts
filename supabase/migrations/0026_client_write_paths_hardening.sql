-- Remove the last direct client write paths into booking state and lock the
-- rate limiter behind the service role.
--
-- 1. "appointments client insert own accepted" (0001) let any signed-in user
--    insert a confirmed appointment for themselves, bypassing every guard in
--    the app. Clients only ever obtain appointments through the SECURITY
--    DEFINER RPCs (respond_to_appointment_proposal, confirm_booking_request).
-- 2. "booking requests client status update" and "proposals client update own"
--    (0001) let a client set ANY status on their own request/proposals (e.g.
--    flip a request to 'confirmed'). The one legitimate client transition —
--    cancelling an open request — moves into client_cancel_request().
-- 3. check_rate_limit was executable by anon/authenticated with predictable
--    keys, so a caller could pre-exhaust another identity's budget. The app now
--    calls it with the service-role client only.

drop policy if exists "appointments client insert own accepted" on public.appointments;
drop policy if exists "booking requests client status update" on public.booking_requests;
drop policy if exists "proposals client update own" on public.appointment_proposals;

-- Client cancels their own pending/proposed request. Confirmed appointments go
-- through client_cancel_confirmed_appointment (0020) instead.
create or replace function public.client_cancel_request(
  p_request_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.booking_requests%rowtype;
begin
  select *
  into v_request
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found or v_request.client_id <> auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_request.status not in ('pending', 'proposed') then
    raise exception 'request is not cancellable' using errcode = 'P0001';
  end if;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = v_request.id
    and status = 'sent';

  update public.booking_requests
  set status = 'cancelled',
      updated_at = now()
  where id = v_request.id;

  return v_request.id;
end;
$$;

revoke execute on function public.client_cancel_request(uuid) from public, anon;
grant execute on function public.client_cancel_request(uuid) to authenticated;

revoke execute on function public.client_cancel_confirmed_appointment(uuid) from public, anon;
grant execute on function public.client_cancel_confirmed_appointment(uuid) to authenticated;

revoke execute on function public.check_rate_limit(text, integer, integer) from public;
revoke execute on function public.check_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
