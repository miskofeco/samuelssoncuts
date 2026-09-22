-- One explicitly designated barber owns the shop schedule. Other approved
-- admins may manage it without becoming bookable barbers themselves.
alter table public.profiles
  add column if not exists is_shop_barber boolean not null default false;

alter table public.profiles
  add constraint profiles_shop_barber_approved_admin
  check (not is_shop_barber or (role = 'admin' and approval_status = 'approved'));

create unique index if not exists profiles_one_shop_barber
  on public.profiles ((true)) where is_shop_barber;

-- A fresh database without the shop account stays unconfigured and fails
-- closed; this existing shop has exactly one approved account by this name.
update public.profiles
set is_shop_barber = true
where role = 'admin'
  and approval_status = 'approved'
  and full_name = 'Samuel Fečo';

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_privileged_change boolean;
begin
  v_privileged_change :=
    new.role is distinct from old.role
    or new.approval_status is distinct from old.approval_status
    or new.email is distinct from old.email
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.calendar_token is distinct from old.calendar_token
    or new.is_shop_barber is distinct from old.is_shop_barber;

  if not v_privileged_change then return new; end if;

  if auth.uid() is null
     or coalesce(current_setting('role', true), '') = 'service_role'
     or coalesce(current_setting('app.rotate_calendar_token', true), '') = 'on'
     or public.is_admin() then
    return new;
  end if;

  raise exception 'privileged profile columns can only be changed by an admin'
    using errcode = '42501';
end;
$$;

create or replace function public.confirm_booking_request(
  p_request_id uuid,
  p_barber_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.booking_requests%rowtype;
  v_appointment_id uuid;
begin
  if not public.is_admin() or not exists (
    select 1 from public.profiles
    where id = p_barber_id and role = 'admin'
      and approval_status = 'approved' and is_shop_barber
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_request
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found
    or v_request.status <> 'pending'
    or v_request.requested_start is null
    or v_request.requested_end is null
    or v_request.requested_start <= now() then
    raise exception 'request is not confirmable' using errcode = 'P0001';
  end if;

  insert into public.appointments(
    request_id, client_id, barber_id, service_id, starts_at, ends_at
  ) values (
    v_request.id, v_request.client_id, p_barber_id, v_request.service_id,
    v_request.requested_start, v_request.requested_end
  ) returning id into v_appointment_id;

  update public.booking_requests
  set status = 'confirmed', updated_at = now()
  where id = v_request.id;

  update public.booking_requests
  set status = 'declined', updated_at = now()
  where status = 'pending'
    and requested_start = v_request.requested_start
    and id <> v_request.id;

  return v_appointment_id;
end;
$$;
revoke execute on function public.confirm_booking_request(uuid, uuid) from public, anon;
grant execute on function public.confirm_booking_request(uuid, uuid) to authenticated;

-- Availability sent to clients is restricted to the designated shop barber.
drop function if exists public.confirmed_appointment_slots();
create function public.confirmed_appointment_slots()
returns table (id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.service_id, a.starts_at, a.ends_at
  from public.appointments a
  where a.status = 'confirmed'
    and exists (
      select 1 from public.profiles barber
      where barber.id = a.barber_id and barber.is_shop_barber
    )
    and a.ends_at >= now() - interval '1 day'
  order by a.starts_at;
$$;
revoke execute on function public.confirmed_appointment_slots() from public, anon;
grant execute on function public.confirmed_appointment_slots() to authenticated;

-- An admin subscription belongs to that barber, not every admin's test data.
create or replace function public.calendar_feed(p_token uuid)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, service_name text, customer text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.starts_at, a.ends_at, s.name,
    coalesce(p.full_name, a.customer_name, 'Walk-in')
  from public.profiles owner
  join public.appointments a
    on (owner.role = 'admin' and owner.is_shop_barber and a.barber_id = owner.id)
       or (owner.role = 'client' and a.client_id = owner.id)
  join public.services s on s.id = a.service_id
  left join public.profiles p on p.id = a.client_id
  where owner.calendar_token = p_token
    and owner.approval_status = 'approved'
    and a.status = 'confirmed'
    and a.starts_at >= now() - interval '30 days'
  order by a.starts_at;
$$;
revoke execute on function public.calendar_feed(uuid) from public;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
