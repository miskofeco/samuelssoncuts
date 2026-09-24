-- Serialize availability and appointment writes for one barber. Application
-- preflight checks give useful feedback; these triggers close the race between
-- a newly confirmed appointment and an administrator closing the same time.
-- All three paths take the same transaction-scoped lock before checking the
-- opposing table. VOLATILE trigger queries see the latest committed rows after
-- waiting for a competing writer under the default READ COMMITTED isolation.

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
  if new.status <> 'confirmed' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barber_id::text, 450045)
  );

  if new.ends_at <= new.starts_at or exists (
    select 1 from public.blocked_times
    where barber_id = new.barber_id
      and starts_at < new.ends_at and ends_at > new.starts_at
  ) then
    raise exception 'appointment conflicts with availability' using errcode = 'P0001';
  end if;

  v_start := new.starts_at at time zone 'Europe/Bratislava';
  v_end := new.ends_at at time zone 'Europe/Bratislava';
  select * into v_hours from public.business_hours
  where barber_id = new.barber_id
    and weekday = extract(dow from v_start)::integer;
  if v_start::date <> v_end::date
     or (found and (
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

create trigger appointments_availability_write_guard
before insert or update of barber_id, starts_at, ends_at, status
on public.appointments
for each row execute function public.guard_appointment_availability_write();
revoke execute on function public.guard_appointment_availability_write()
  from public, anon, authenticated;

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
      and starts_at < new.ends_at and ends_at > new.starts_at
  ) then
    raise exception 'blocked time conflicts with a confirmed appointment' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger blocked_times_appointment_write_guard
before insert or update of barber_id, starts_at, ends_at
on public.blocked_times
for each row execute function public.guard_blocked_time_write();
revoke execute on function public.guard_blocked_time_write()
  from public, anon, authenticated;

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

create trigger business_hours_appointment_write_guard
before insert or update of barber_id, weekday, opens_at, closes_at, closed or delete
on public.business_hours
for each row execute function public.guard_business_hours_write();
revoke execute on function public.guard_business_hours_write()
  from public, anon, authenticated;
