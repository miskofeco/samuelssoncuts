-- Run only against a disposable, empty PostgreSQL database with psql -X -v
-- ON_ERROR_STOP=1 -f tests/database/0043_proposal_push_hardening.sql.
-- The fixture is intentionally small and the entire test rolls back.
begin;

create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create type public.request_status as enum ('pending', 'proposed', 'confirmed', 'declined', 'cancelled');
create type public.proposal_status as enum ('sent', 'accepted', 'declined', 'expired');
create table public.profiles (
  id uuid primary key,
  role text not null,
  approval_status text not null,
  is_shop_barber boolean not null default false
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
  barber_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);
create table public.booking_requests (
  id uuid primary key,
  client_id uuid not null,
  service_id uuid not null,
  status public.request_status not null,
  selected_proposal_id uuid,
  updated_at timestamptz not null default now()
);
create table public.appointment_proposals (
  id uuid primary key,
  request_id uuid not null,
  barber_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.proposal_status not null
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  proposal_id uuid,
  client_id uuid,
  barber_id uuid,
  service_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'confirmed'
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  enabled boolean not null default true,
  failure_count integer not null default 0,
  last_failure_at timestamptz
);

create function public.is_approved_client() returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and approval_status = 'approved'
  );
$$;
create function public.has_confirmed_appointment_overlap(
  p_barber_id uuid, p_start timestamptz, p_end timestamptz, p_exclude_appointment_id uuid
) returns boolean language sql stable as $$
  select exists (
    select 1 from public.appointments
    where barber_id = p_barber_id and status = 'confirmed'
      and starts_at < p_end and ends_at > p_start
      and id is distinct from p_exclude_appointment_id
  );
$$;
create function public.admin_cancel_appointment(uuid, boolean) returns uuid
  language sql as $$ select $1; $$;
create function public.client_cancel_request(uuid) returns uuid
  language sql as $$ select $1; $$;
create function public.client_cancel_confirmed_appointment(uuid) returns uuid
  language sql as $$ select $1; $$;

grant usage on schema public to authenticated;
grant select, insert, update on public.push_subscriptions to authenticated;
grant select on public.appointment_proposals, public.booking_requests, public.appointments to authenticated;
grant select, insert, update, delete on public.business_hours, public.blocked_times to authenticated;

\ir ../../supabase/migrations/0043_proposal_and_push_hardening.sql

create table public.touch_probe(id integer primary key, updated_at timestamptz not null);
create trigger touch_probe_updated_at before update on public.touch_probe
for each row execute function public.touch_updated_at();
insert into public.touch_probe values (1, '2000-01-01');
grant select, update on public.touch_probe to authenticated;

insert into public.profiles(id, role, approval_status, is_shop_barber) values
  ('00000000-0000-4000-8000-000000000001', 'admin', 'approved', true),
  ('00000000-0000-4000-8000-000000000002', 'client', 'approved', false),
  ('00000000-0000-4000-8000-000000000003', 'client', 'approved', false);

insert into public.booking_requests(id, client_id, service_id, status, selected_proposal_id) values
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'proposed', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'proposed', '00000000-0000-4000-8000-000000000008'),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'proposed', '00000000-0000-4000-8000-000000000010');

insert into public.appointment_proposals(id, request_id, barber_id, starts_at, ends_at, status)
select id, request_id, '00000000-0000-4000-8000-000000000001',
  local_start at time zone 'Europe/Bratislava',
  (local_start + interval '1 hour') at time zone 'Europe/Bratislava',
  'sent'::public.proposal_status
from (
  select '00000000-0000-4000-8000-000000000006'::uuid id,
         '00000000-0000-4000-8000-000000000005'::uuid request_id,
         (now() at time zone 'Europe/Bratislava')::date + 1 + time '10:00' local_start
  union all
  select '00000000-0000-4000-8000-000000000008',
         '00000000-0000-4000-8000-000000000007',
         (now() at time zone 'Europe/Bratislava')::date + 1 + time '10:00'
  union all
  select '00000000-0000-4000-8000-000000000010',
         '00000000-0000-4000-8000-000000000009',
         (now() at time zone 'Europe/Bratislava')::date + 15 + time '10:00'
) fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
update public.touch_probe set updated_at = '2000-01-01' where id = 1;
do $$begin
  if (select updated_at from public.touch_probe where id = 1) < now() - interval '1 minute' then
    raise exception 'trigger lost execute privileges after revoke';
  end if;
end;$$;

do $$
declare
  v_a uuid := '00000000-0000-4000-8000-000000000002';
  v_other uuid := '00000000-0000-4000-8000-000000000006';
  v_own uuid := '00000000-0000-4000-8000-000000000008';
  v_late uuid := '00000000-0000-4000-8000-000000000010';
  v_start timestamptz;
  v_appointment uuid;
  v_rejected boolean;
begin
  begin
    perform public.respond_to_appointment_proposal(v_other, null, false);
    raise exception 'null client id changed another client proposal';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.respond_to_appointment_proposal(v_other, v_a, false);
    raise exception 'wrong owner changed another client proposal';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.respond_to_appointment_proposal(v_own, v_a, null);
    raise exception 'null decision was accepted';
  exception when sqlstate '42501' then null;
  end;

  select starts_at into v_start from public.appointment_proposals where id = v_own;
  insert into public.blocked_times(barber_id, starts_at, ends_at) values (
    '00000000-0000-4000-8000-000000000001', v_start + interval '30 minutes', v_start + interval '45 minutes'
  );
  v_rejected := false;
  begin
    perform public.respond_to_appointment_proposal(v_own, v_a, true);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'blocked proposal was accepted'; end if;
  delete from public.blocked_times;

  insert into public.business_hours(barber_id, weekday, opens_at, closes_at, closed) values (
    '00000000-0000-4000-8000-000000000001',
    extract(dow from v_start at time zone 'Europe/Bratislava')::integer,
    '07:00', '21:00', true
  );
  v_rejected := false;
  begin
    perform public.respond_to_appointment_proposal(v_own, v_a, true);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'closed-day proposal was accepted'; end if;
  update public.business_hours set closes_at = '10:30', closed = false;
  v_rejected := false;
  begin
    perform public.respond_to_appointment_proposal(v_own, v_a, true);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'outside-hours proposal was accepted'; end if;
  update public.business_hours set closes_at = '21:00';

  v_rejected := false;
  begin
    perform public.respond_to_appointment_proposal(v_late, v_a, true);
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'beyond-horizon proposal was accepted'; end if;
  perform public.respond_to_appointment_proposal(v_late, v_a, false);

  v_appointment := public.respond_to_appointment_proposal(v_own, v_a, true);
  if v_appointment is null
     or not exists (
       select 1 from public.appointments
       where id = v_appointment and client_id = v_a
         and starts_at = v_start
     ) then
    raise exception 'valid proposal did not create owned appointment';
  end if;
  if not exists (
    select 1 from public.booking_requests where id = '00000000-0000-4000-8000-000000000007'
      and status = 'confirmed'
  ) then
    raise exception 'request did not transition to confirmed';
  end if;
  if not exists (
    select 1 from public.appointment_proposals where id = v_other and status = 'sent'
  ) then
    raise exception 'other client proposal was modified';
  end if;
end;
$$;

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-000000000002';
  v_other uuid := '00000000-0000-4000-8000-000000000003';
  v_count integer;
  v_rejected boolean;
begin
  begin
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (v_user, 'https://127.0.0.1/internal', 'key', 'secret');
    raise exception 'loopback endpoint was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (v_user, 'https://fcm.googleapis.com:443/fcm/send/1', 'key', 'secret');
    raise exception 'explicit port was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (v_user, 'https://fcm.googleapis.com/fcm/send/1?x=1', 'key', 'secret');
    raise exception 'query was accepted';
  exception when check_violation then null;
  end;
  for i in 1..8 loop
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (v_user, 'https://fcm.googleapis.com/fcm/send/' || i, 'key', 'secret');
  end loop;
  v_rejected := false;
  begin
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (v_user, 'https://web.push.apple.com/9', 'key', 'secret');
  exception when sqlstate 'P0001' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'ninth device was accepted'; end if;
  -- Refreshing an existing endpoint must still work at the limit.
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
  values (v_user, 'https://fcm.googleapis.com/fcm/send/1', 'new-key', 'new-auth')
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;

  -- A device can be rebound to a new account and no longer belongs to A.
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
  values (v_other, 'https://fcm.googleapis.com/fcm/send/1', 'new-key', 'new-auth')
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
  select count(*) into v_count from public.push_subscriptions where user_id = v_user;
  if v_count <> 7 then
    raise exception 'device ownership did not move';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.respond_to_appointment_proposal(uuid, uuid, boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_cancel_appointment(uuid, boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.client_cancel_request(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.client_cancel_confirmed_appointment(uuid)', 'EXECUTE') then
    raise exception 'anonymous execute remains granted';
  end if;
end;
$$;

rollback;
