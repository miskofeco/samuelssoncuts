-- Atomically decline an open booking request and close every outstanding
-- proposal. The caller must be an admin; clients cannot invoke this lifecycle
-- transition through the Data API.

create or replace function public.admin_decline_booking_request(
  p_request_id uuid,
  p_reason text default null
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
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_reason is not null and length(p_reason) > 1000 then
    raise exception 'reason is too long' using errcode = '22001';
  end if;

  select *
  into v_request
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'booking request not found' using errcode = 'P0002';
  end if;

  if v_request.status not in ('pending', 'proposed') then
    raise exception 'booking request is not open' using errcode = 'P0001';
  end if;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = v_request.id
    and status = 'sent';

  update public.booking_requests
  set status = 'declined',
      selected_proposal_id = null,
      updated_at = now()
  where id = v_request.id;

  return v_request.client_id;
end;
$$;

revoke execute on function public.admin_decline_booking_request(uuid, text) from public, anon;
grant execute on function public.admin_decline_booking_request(uuid, text) to authenticated;
