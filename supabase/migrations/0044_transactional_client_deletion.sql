-- Keep account deletion and its dependent booking cleanup in one Postgres
-- transaction. Storage objects must be removed through Storage API first;
-- deleting auth.users is then the last statement in this function.
create or replace function public.delete_client_account(p_client_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if p_client_id is null then
    raise exception 'client id is required' using errcode = 'P0001';
  end if;

  select role into v_role
  from public.profiles
  where id = p_client_id
  for update;

  if not found or v_role <> 'client' then
    raise exception 'client account not found' using errcode = 'P0002';
  end if;

  -- appointments.request_id and appointments.client_id are restrictive foreign
  -- keys; remove them before booking_requests and the auth user. If any step
  -- fails, the function rolls all of these database changes back together.
  delete from public.appointments
  where client_id = p_client_id
     or request_id in (
       select id from public.booking_requests where client_id = p_client_id
     );

  update public.booking_requests
  set selected_proposal_id = null
  where client_id = p_client_id;

  delete from public.booking_requests where client_id = p_client_id;
  delete from auth.users where id = p_client_id;

  if not found then
    raise exception 'auth user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_client_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_client_account(uuid) to service_role;

-- Every appointment owns an immutable quoted amount and optional booking note.
-- Existing rows can only be frozen at the value known during this migration;
-- earlier catalog prices cannot be reconstructed from the current schema.
alter table public.appointments
  add column price_cents integer,
  add column note text;

update public.appointments a
set price_cents = coalesce(
  (select r.price_cents from public.booking_requests r where r.id = a.request_id),
  (select s.price_cents from public.services s where s.id = a.service_id)
);

alter table public.appointments
  alter column price_cents set not null,
  add constraint appointments_price_cents_nonnegative check (price_cents >= 0);

create or replace function public.appointments_snapshot_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price_cents is null then
    new.price_cents := coalesce(
      (select r.price_cents from public.booking_requests r where r.id = new.request_id),
      (select s.price_cents from public.services s where s.id = new.service_id)
    );
  end if;
  if new.price_cents is null or new.price_cents < 0 then
    raise exception 'appointment price is required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger appointments_snapshot_price_before_insert
before insert on public.appointments
for each row execute function public.appointments_snapshot_price();

-- Creating a manual booking and its optional request in one transaction keeps
-- registered-client appointments reschedulable and avoids orphan requests.
create or replace function public.admin_create_booking(
  p_client_id uuid,
  p_customer_name text,
  p_service_id uuid,
  p_start timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_barber_id uuid;
  v_service public.services%rowtype;
  v_end timestamptz;
  v_request_id uuid;
  v_appointment_id uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_hours public.business_hours%rowtype;
begin
  if (p_client_id is null) = (nullif(btrim(p_customer_name), '') is null)
     or p_start is null or p_start <= now() then
    raise exception 'invalid booking' using errcode = 'P0001';
  end if;

  select id into v_barber_id
  from public.profiles
  where is_shop_barber and role = 'admin' and approval_status = 'approved';
  if v_barber_id is null then
    raise exception 'shop barber unavailable' using errcode = 'P0001';
  end if;

  if p_client_id is not null and not exists (
    select 1 from public.profiles
    where id = p_client_id and role = 'client' and approval_status = 'approved'
  ) then
    raise exception 'client unavailable' using errcode = 'P0001';
  end if;

  select * into v_service from public.services where id = p_service_id for share;
  if not found or not v_service.active then
    raise exception 'service unavailable' using errcode = 'P0001';
  end if;
  v_end := p_start + make_interval(mins => v_service.duration_minutes);
  v_local_start := p_start at time zone 'Europe/Bratislava';
  v_local_end := v_end at time zone 'Europe/Bratislava';

  select * into v_hours from public.business_hours
  where barber_id = v_barber_id
    and weekday = extract(dow from v_local_start)::integer;
  if v_local_end::date <> v_local_start::date
     or (found and (
       v_hours.closed or v_local_start::time < v_hours.opens_at
       or v_local_end::time > v_hours.closes_at
     ))
     or (not found and (
       extract(dow from v_local_start) = 0
       or v_local_start::time < time '07:00'
       or v_local_end::time > time '21:00'
     )) then
    raise exception 'outside business hours' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.blocked_times
    where barber_id = v_barber_id and starts_at < v_end and ends_at > p_start
  ) or public.has_confirmed_appointment_overlap(v_barber_id, p_start, v_end) then
    raise exception 'booking time unavailable' using errcode = 'P0001';
  end if;

  if p_client_id is not null then
    insert into public.booking_requests (
      client_id, service_id, note, status, requested_start, requested_end,
      price_cents, surcharge
    ) values (
      p_client_id, p_service_id, p_note, 'confirmed', p_start, v_end,
      v_service.price_cents, false
    ) returning id into v_request_id;
  end if;

  insert into public.appointments (
    request_id, proposal_id, client_id, customer_name, barber_id, service_id,
    starts_at, ends_at, price_cents, note
  ) values (
    v_request_id, null, p_client_id, nullif(btrim(p_customer_name), ''),
    v_barber_id, p_service_id, p_start, v_end, v_service.price_cents, p_note
  ) returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.admin_create_booking(uuid, text, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_booking(uuid, text, uuid, timestamptz, text)
  to service_role;

-- Replacing a proposed time must lock and recheck the parent request before
-- expiring its previous proposal. A concurrent cancel/confirm cannot be
-- revived by a late, unconditional status update.
create or replace function public.admin_replace_proposal(
  p_request_id uuid,
  p_start timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.booking_requests%rowtype;
  v_service public.services%rowtype;
  v_barber_id uuid;
  v_end timestamptz;
  v_proposal_id uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_hours public.business_hours%rowtype;
begin
  if p_start is null or p_start <= now() or length(coalesce(p_note, '')) > 1000 then
    raise exception 'invalid proposal' using errcode = 'P0001';
  end if;

  select * into v_request from public.booking_requests
  where id = p_request_id for update;
  if not found or v_request.status not in ('pending', 'proposed') then
    raise exception 'request is not open' using errcode = 'P0001';
  end if;

  select * into v_service from public.services
  where id = v_request.service_id for share;
  if not found then
    raise exception 'service not found' using errcode = 'P0002';
  end if;

  select id into v_barber_id from public.profiles
  where is_shop_barber and role = 'admin' and approval_status = 'approved';
  if v_barber_id is null then
    raise exception 'shop barber unavailable' using errcode = 'P0001';
  end if;

  v_end := p_start + make_interval(mins => v_service.duration_minutes);
  v_local_start := p_start at time zone 'Europe/Bratislava';
  v_local_end := v_end at time zone 'Europe/Bratislava';
  if v_local_start::date > (now() at time zone 'Europe/Bratislava')::date + 14
     or v_local_end::date <> v_local_start::date then
    raise exception 'proposal outside booking window' using errcode = 'P0001';
  end if;

  select * into v_hours from public.business_hours
  where barber_id = v_barber_id
    and weekday = extract(dow from v_local_start)::integer;
  if (found and (
       v_hours.closed or v_local_start::time < v_hours.opens_at
       or v_local_end::time > v_hours.closes_at
     ))
     or (not found and (
       extract(dow from v_local_start) = 0
       or v_local_start::time < time '07:00'
       or v_local_end::time > time '21:00'
     )) then
    raise exception 'proposal outside business hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.blocked_times
    where barber_id = v_barber_id and starts_at < v_end and ends_at > p_start
  ) or public.has_confirmed_appointment_overlap(v_barber_id, p_start, v_end) then
    raise exception 'proposal time unavailable' using errcode = 'P0001';
  end if;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = p_request_id and status = 'sent';

  insert into public.appointment_proposals (
    request_id, barber_id, starts_at, ends_at, note
  ) values (p_request_id, v_barber_id, p_start, v_end, p_note)
  returning id into v_proposal_id;

  update public.booking_requests
  set status = 'proposed', selected_proposal_id = v_proposal_id,
      updated_at = now()
  where id = p_request_id;

  return v_proposal_id;
end;
$$;

revoke all on function public.admin_replace_proposal(uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.admin_replace_proposal(uuid, timestamptz, text)
  to service_role;

-- A confirmed request becomes pending again when its client asks to
-- reschedule. Its previously accepted proposal must not remain selected;
-- otherwise reservation views can display the old proposal as the new offer.
create or replace function public.clear_selected_proposal_on_reopen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'pending' then
    new.selected_proposal_id := null;
  end if;
  return new;
end;
$$;

create trigger booking_requests_clear_selected_proposal_on_reopen
before update on public.booking_requests
for each row execute function public.clear_selected_proposal_on_reopen();

revoke execute on function public.clear_selected_proposal_on_reopen()
  from public, anon, authenticated;
