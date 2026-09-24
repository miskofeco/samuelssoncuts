-- Run only against a disposable, empty PostgreSQL database with psql -X -v
-- ON_ERROR_STOP=1 -f tests/database/0050_admin_availability_override.sql.
-- The fixture is intentionally small and the entire test rolls back.
begin;

create role anon;
create role authenticated;
create role service_role;

create table public.profiles (
  id uuid primary key,
  role text not null,
  approval_status text not null,
  is_shop_barber boolean not null default false
);
create table public.services (
  id uuid primary key,
  duration_minutes integer not null,
  price_cents integer not null,
  active boolean not null default true
);
create table public.business_hours (
  barber_id uuid not null,
  weekday integer not null,
  opens_at time not null,
  closes_at time not null,
  closed boolean not null default false,
  primary key (barber_id, weekday)
);
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  service_id uuid not null,
  note text,
  status text not null,
  requested_start timestamptz,
  requested_end timestamptz,
  price_cents integer,
  surcharge boolean
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  proposal_id uuid,
  client_id uuid,
  customer_name text,
  barber_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_cents integer,
  note text,
  status text not null default 'confirmed'
);

create function public.has_confirmed_appointment_overlap(
  p_barber_id uuid, p_start timestamptz, p_end timestamptz,
  p_exclude_appointment_id uuid default null
) returns boolean language sql stable as $$
  select exists (
    select 1 from public.appointments
    where barber_id = p_barber_id and status = 'confirmed'
      and starts_at < p_end and ends_at > p_start
      and id is distinct from p_exclude_appointment_id
  );
$$;

-- Pre-0050 signatures that the migration drops and recreates.
create function public.admin_create_booking(uuid, text, uuid, timestamptz, text default null)
  returns uuid language sql as $$ select null::uuid; $$;
create function public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text default null)
  returns uuid language sql as $$ select null::uuid; $$;
create function public.guard_appointment_availability_write() returns trigger
  language plpgsql as $$ begin return new; end; $$;
create function public.guard_blocked_time_write() returns trigger
  language plpgsql as $$ begin return new; end; $$;
create function public.guard_business_hours_write() returns trigger
  language plpgsql as $$ begin return new; end; $$;
create trigger appointments_availability_write_guard
before insert or update of barber_id, starts_at, ends_at, status
on public.appointments
for each row execute function public.guard_appointment_availability_write();
create trigger blocked_times_appointment_write_guard
before insert or update of barber_id, starts_at, ends_at
on public.blocked_times
for each row execute function public.guard_blocked_time_write();
create trigger business_hours_appointment_write_guard
before insert or update of barber_id, weekday, opens_at, closes_at, closed or delete
on public.business_hours
for each row execute function public.guard_business_hours_write();

\ir ../../supabase/migrations/0050_admin_availability_override.sql

insert into public.profiles values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'approved', true);
insert into public.services values
  ('00000000-0000-0000-0000-0000000000a1', 60, 2000, true);
-- Sundays open 08:00–14:00; Wednesdays 09:00–20:00.
insert into public.business_hours values
  ('00000000-0000-0000-0000-000000000001', 0, '08:00', '14:00', false),
  ('00000000-0000-0000-0000-000000000001', 3, '09:00', '20:00', false);

create function pg_temp.next_local(p_weekday integer, p_time time) returns timestamptz
language sql as $$
  select (
    (date_trunc('week', now() at time zone 'Europe/Bratislava')::date + 7
      + ((p_weekday + 6) % 7))
    + p_time
  ) at time zone 'Europe/Bratislava';
$$;

do $$
declare
  v_service uuid := '00000000-0000-0000-0000-0000000000a1';
  v_barber uuid := '00000000-0000-0000-0000-000000000001';
  v_id uuid;
  v_override boolean;
  v_rejected boolean;
begin
  -- Closed hours are refused without the opt-in.
  v_rejected := false;
  begin
    perform public.admin_create_booking_priced(
      null, 'Walk-in', v_service, pg_temp.next_local(0, '15:00'), 2000, false, null);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'closed-hours booking accepted without override'; end if;

  -- With the opt-in the booking lands and is flagged.
  v_id := public.admin_create_booking_priced(
    null, 'Walk-in', v_service, pg_temp.next_local(0, '15:00'), 2000, false, null, true);
  select availability_override into v_override from public.appointments where id = v_id;
  if v_override is distinct from true then raise exception 'override appointment not flagged'; end if;

  -- The opt-in never waives confirmed-overlap protection.
  v_rejected := false;
  begin
    perform public.admin_create_booking_priced(
      null, 'Walk-in', v_service, pg_temp.next_local(0, '15:30'), 2000, false, null, true);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'override booking overlapped a confirmed appointment'; end if;

  -- A slot inside availability is not flagged even when the opt-in is sent.
  v_id := public.admin_create_booking_priced(
    null, 'Walk-in', v_service, pg_temp.next_local(3, '10:00'), 2000, false, null, true);
  select availability_override into v_override from public.appointments where id = v_id;
  if v_override then raise exception 'available slot was flagged as override'; end if;

  -- Blocked time: refused without the opt-in, accepted and flagged with it.
  insert into public.blocked_times (barber_id, starts_at, ends_at)
  values (v_barber, pg_temp.next_local(3, '12:00'), pg_temp.next_local(3, '13:00'));
  v_rejected := false;
  begin
    perform public.admin_create_booking_priced(
      null, 'Walk-in', v_service, pg_temp.next_local(3, '12:00'), 2000, false, null);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'blocked booking accepted without override'; end if;
  v_id := public.admin_create_booking_priced(
    null, 'Walk-in', v_service, pg_temp.next_local(3, '12:00'), 2000, false, null, true);
  select availability_override into v_override from public.appointments where id = v_id;
  if v_override is distinct from true then raise exception 'blocked override not flagged'; end if;

  -- Moving an override appointment drops the flag and revalidates the new time.
  v_rejected := false;
  begin
    update public.appointments
    set starts_at = pg_temp.next_local(0, '16:00'), ends_at = pg_temp.next_local(0, '17:00')
    where id = v_id;
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'moved override appointment skipped availability'; end if;
end;
$$;

-- Hours and block edits ignore override appointments but still protect normal ones.
do $$
declare
  v_barber uuid := '00000000-0000-0000-0000-000000000001';
  v_rejected boolean;
begin
  -- Sunday only holds the 15:00 override booking: closing Sunday is allowed.
  update public.business_hours set closed = true where barber_id = v_barber and weekday = 0;
  insert into public.blocked_times (barber_id, starts_at, ends_at)
  values (v_barber, pg_temp.next_local(0, '14:30'), pg_temp.next_local(0, '17:00'));

  -- Wednesday 10:00 is an ordinary booking: closing Wednesday is refused.
  v_rejected := false;
  begin
    update public.business_hours set closed = true where barber_id = v_barber and weekday = 3;
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'hours edit invalidated an ordinary booking'; end if;

  v_rejected := false;
  begin
    insert into public.blocked_times (barber_id, starts_at, ends_at)
    values (v_barber, pg_temp.next_local(3, '09:30'), pg_temp.next_local(3, '10:30'));
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'block covered an ordinary booking'; end if;
end;
$$;

-- Only the service role may call the manual-booking RPCs.
do $$
begin
  if has_function_privilege('authenticated',
    'public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text, boolean)', 'execute')
     or has_function_privilege('anon',
    'public.admin_create_booking(uuid, text, uuid, timestamptz, text, boolean)', 'execute') then
    raise exception 'manual booking RPC is callable by a client role';
  end if;
  if not has_function_privilege('service_role',
    'public.admin_create_booking_priced(uuid, text, uuid, timestamptz, integer, boolean, text, boolean)', 'execute') then
    raise exception 'service role lost manual booking RPC';
  end if;
end;
$$;

rollback;
