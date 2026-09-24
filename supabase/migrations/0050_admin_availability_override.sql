-- The barber may deliberately book a manual appointment into closed hours or
-- blocked time after confirming a warning. Such appointments carry
-- `availability_override`, set only by the service-role manual-booking RPC when
-- the slot really is outside availability and the caller explicitly allowed it.
-- Confirmed-overlap protection (exclusion constraint + RPC check) is unchanged.
alter table public.appointments
  add column availability_override boolean not null default false;

-- Appointment write guard: an override appointment skips the blocked-time and
-- opening-hours checks, but must still start and end on the same shop day.
-- Moving an appointment drops the override unless the writer explicitly sets
-- it again, so a reschedule is validated against availability like any other.
create or replace function public.guard_appointment_availability_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_start timestamp;
  v_end timestamp;
  v_hours public.business_hours%rowtype;
begin
  if tg_op = 'UPDATE'
     and (new.barber_id, new.starts_at, new.ends_at)
       is distinct from (old.barber_id, old.starts_at, old.ends_at)
     and new.availability_override is not distinct from old.availability_override then
    new.availability_override := false;
  end if;

  if new.status <> 'confirmed' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barber_id::text, 450045)
  );

  v_start := new.starts_at at time zone 'Europe/Bratislava';
  v_end := new.ends_at at time zone 'Europe/Bratislava';
  if new.ends_at <= new.starts_at or v_start::date <> v_end::date then
    raise exception 'appointment outside business hours' using errcode = 'P0001';
  end if;
  if new.availability_override then return new; end if;

  if exists (
    select 1 from public.blocked_times
    where barber_id = new.barber_id
      and starts_at < new.ends_at and ends_at > new.starts_at
  ) then
    raise exception 'appointment conflicts with availability' using errcode = 'P0001';
  end if;

  select * into v_hours from public.business_hours
  where barber_id = new.barber_id
    and weekday = extract(dow from v_start)::integer;
  if (found and (
       v_hours.closed or v_start::time < v_hours.opens_at
       or v_end::time > v_hours.closes_at
     ))
     or (not found and (
       extract(dow from v_start) = 0
       or v_start::time < time '07:00'
       or v_end::time > time '21:00'
     )) then
    raise exception 'appointment outside business hours' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_appointment_availability_write()
  from public, anon, authenticated;

-- A block may cover an appointment the barber already booked on purpose
-- outside availability; ordinary confirmed appointments still refuse it.
create or replace function public.guard_blocked_time_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barber_id::text, 450045)
  );
  if new.ends_at <= new.starts_at or exists (
    select 1 from public.appointments
    where barber_id = new.barber_id and status = 'confirmed'
      and not availability_override
      and starts_at < new.ends_at and ends_at > new.starts_at
  ) then
    raise exception 'blocked time conflicts with a confirmed appointment' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_blocked_time_write()
  from public, anon, authenticated;

-- Opening-hour edits ignore override appointments for the same reason.
create or replace function public.guard_business_hours_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_barber_id uuid;
  v_weekday integer;
  v_closed boolean;
  v_opens time;
  v_closes time;
begin
  if tg_op = 'UPDATE' and (
    new.barber_id is distinct from old.barber_id
    or new.weekday is distinct from old.weekday
  ) then
    raise exception 'business hours identity cannot change' using errcode = 'P0001';
  end if;
  v_barber_id := case when tg_op = 'DELETE' then old.barber_id else new.barber_id end;
  v_weekday := case when tg_op = 'DELETE' then old.weekday else new.weekday end;
  v_closed := case when tg_op = 'DELETE' then v_weekday = 0 else new.closed end;
  v_opens := case when tg_op = 'DELETE' then time '07:00' else new.opens_at end;
  v_closes := case when tg_op = 'DELETE' then time '21:00' else new.closes_at end;
  if not v_closed and v_opens >= v_closes then
    raise exception 'invalid business hours' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_barber_id::text, 450045)
  );
  if exists (
    select 1 from public.appointments a
    where a.barber_id = v_barber_id and a.status = 'confirmed'
      and not a.availability_override
      and a.ends_at > now()
      and extract(dow from a.starts_at at time zone 'Europe/Bratislava') = v_weekday
      and (
        v_closed
        or (a.starts_at at time zone 'Europe/Bratislava')::date <>
           (a.ends_at at time zone 'Europe/Bratislava')::date
        or (a.starts_at at time zone 'Europe/Bratislava')::time < v_opens
        or (a.ends_at at time zone 'Europe/Bratislava')::time > v_closes
      )
  ) then
    raise exception 'business hours conflict with a confirmed appointment'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.guard_business_hours_write()
  from public, anon, authenticated;

-- Manual booking gains an explicit opt-in. Without it the RPC rejects closed
-- hours and blocked time exactly as before; with it those two checks are
-- waived and the appointment is flagged, while the past, same-day and
-- confirmed-overlap checks always apply.
drop function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text);
drop function public.admin_create_booking(uuid, text, uuid, timestamptz, text);

create function public.admin_create_booking(
  p_client_id uuid,
  p_customer_name text,
  p_service_id uuid,
  p_start timestamptz,
  p_note text default null,
  p_allow_unavailable boolean default false
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
  v_outside_hours boolean;
  v_blocked boolean;
begin
  if (p_client_id is null) = (nullif(btrim(p_customer_name), '') is null)
     or p_start is null or p_start <= now() or p_allow_unavailable is null then
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
  if v_local_end::date <> v_local_start::date then
    raise exception 'outside business hours' using errcode = 'P0001';
  end if;

  select * into v_hours from public.business_hours
  where barber_id = v_barber_id
    and weekday = extract(dow from v_local_start)::integer;
  v_outside_hours := (found and (
       v_hours.closed or v_local_start::time < v_hours.opens_at
       or v_local_end::time > v_hours.closes_at
     ))
     or (not found and (
       extract(dow from v_local_start) = 0
       or v_local_start::time < time '07:00'
       or v_local_end::time > time '21:00'
     ));
  v_blocked := exists (
    select 1 from public.blocked_times
    where barber_id = v_barber_id and starts_at < v_end and ends_at > p_start
  );

  if v_outside_hours and not p_allow_unavailable then
    raise exception 'outside business hours' using errcode = 'P0001';
  end if;
  if (v_blocked and not p_allow_unavailable)
     or public.has_confirmed_appointment_overlap(v_barber_id, p_start, v_end) then
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
    starts_at, ends_at, price_cents, note, availability_override
  ) values (
    v_request_id, null, p_client_id, nullif(btrim(p_customer_name), ''),
    v_barber_id, p_service_id, p_start, v_end, v_service.price_cents, p_note,
    v_outside_hours or v_blocked
  ) returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.admin_create_booking(uuid, text, uuid, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_create_booking(uuid, text, uuid, timestamptz, text, boolean)
  to service_role;

create function public.admin_create_booking_priced(
  p_client_id uuid,
  p_customer_name text,
  p_service_id uuid,
  p_start timestamptz,
  p_price_cents integer,
  p_surcharge boolean,
  p_note text default null,
  p_allow_unavailable boolean default false
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
    p_client_id, p_customer_name, p_service_id, p_start, p_note, p_allow_unavailable
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

revoke all on function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text, boolean)
  to service_role;
