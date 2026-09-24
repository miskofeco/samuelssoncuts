-- Keep the existing service-role booking RPC's validation and appointment /
-- request creation in one transaction, then snapshot the barber's agreed
-- price on both rows before the RPC commits. A custom amount has no implied
-- percentage: callers set surcharge only when it matches the current quote.
create function public.admin_create_booking_priced(
  p_client_id uuid,
  p_customer_name text,
  p_service_id uuid,
  p_start timestamptz,
  p_price_cents integer,
  p_surcharge boolean,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
  v_request_id uuid;
begin
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 1000000
     or p_surcharge is null then
    raise exception 'invalid booking price' using errcode = 'P0001';
  end if;

  select public.admin_create_booking(
    p_client_id, p_customer_name, p_service_id, p_start, p_note
  ) into v_appointment_id;

  update public.appointments
  set price_cents = p_price_cents
  where id = v_appointment_id
  returning request_id into v_request_id;
  if not found then
    raise exception 'booking unavailable' using errcode = 'P0001';
  end if;

  if v_request_id is not null then
    update public.booking_requests
    set price_cents = p_price_cents, surcharge = p_surcharge
    where id = v_request_id;
    if not found then
      raise exception 'booking request unavailable' using errcode = 'P0001';
    end if;
  end if;

  return v_appointment_id;
end;
$$;

revoke all on function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text)
  to service_role;
