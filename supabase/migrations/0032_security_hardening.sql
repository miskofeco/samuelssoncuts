-- Security and integrity hardening found in the September 2026 audit.
--
--  1. Booking price is decided by the server only: the direct client INSERT
--     policy on booking_requests is dropped (the action inserts through the
--     service role after quoting), and client_request_reschedule no longer
--     accepts a caller-supplied price. It is service-role only and takes the
--     acting client id explicitly.
--  2. Client-facing RPCs check approval_status = 'approved', not just ownership.
--  3. Anonymous execute is revoked from every SECURITY DEFINER helper that was
--     left on PUBLIC's default grant (confirmed_appointment_slots leaked the
--     whole schedule to anyone holding the anon key).
--  4. phone_taken becomes service-role only: it was an unauthenticated phone
--     number enumeration oracle.
--  5. Storage buckets get size / MIME limits; push subscription upserts move
--     into an RPC that can reassign an endpoint to the current user.
--  6. Calendar feed tokens can be rotated and stop working for accounts that
--     are no longer approved.
--  7. Personal data in notifications is scrubbed when a profile is deleted.
--  8. Invariants and indexes: one 'sent' proposal per request, hot-path indexes.
--  9. handle_new_user stores a canonical, length-capped phone/name.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'client'
      and approval_status = 'approved'
  );
$$;
revoke execute on function public.is_approved_client() from public, anon;
grant execute on function public.is_approved_client() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Booking price is server-authoritative
-- ---------------------------------------------------------------------------
drop policy if exists "booking requests approved client insert" on public.booking_requests;

drop function if exists public.client_request_reschedule(uuid, timestamptz, integer, boolean);

create or replace function public.client_request_reschedule(
  p_appointment_id uuid,
  p_client_id uuid,
  p_new_start timestamptz,
  p_price_cents integer,
  p_surcharge boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_duration interval;
  v_new_end timestamptz;
begin
  -- Service-role only (the grant below); the action has already authenticated
  -- the client and computed the quote, so p_client_id is trusted here.
  if p_client_id is null or p_price_cents is null or p_price_cents < 0 then
    raise exception 'invalid arguments' using errcode = 'P0001';
  end if;

  select * into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found or v_appt.client_id is null or v_appt.client_id <> p_client_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_client_id and role = 'client' and approval_status = 'approved'
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not reschedulable' using errcode = 'P0001';
  end if;

  if v_appt.request_id is null then
    raise exception 'appointment has no request to reopen' using errcode = 'P0001';
  end if;

  if v_appt.starts_at <= now() + interval '24 hours'
     or p_new_start <= now() + interval '24 hours' then
    raise exception 'too late to reschedule' using errcode = 'P0001';
  end if;

  v_duration := v_appt.ends_at - v_appt.starts_at;
  v_new_end := p_new_start + v_duration;

  if public.has_confirmed_appointment_overlap(v_appt.barber_id, p_new_start, v_new_end, v_appt.id) then
    raise exception 'requested time is no longer available' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled', outcome = 'cancelled'
  where id = v_appt.id;

  update public.booking_requests
  set requested_start = p_new_start,
      requested_end = v_new_end,
      price_cents = p_price_cents,
      surcharge = coalesce(p_surcharge, false),
      status = 'pending',
      updated_at = now()
  where id = v_appt.request_id;

  return v_appt.request_id;
end;
$$;

revoke execute on function public.client_request_reschedule(uuid, uuid, timestamptz, integer, boolean) from public, anon, authenticated;
grant execute on function public.client_request_reschedule(uuid, uuid, timestamptz, integer, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Client RPCs require an approved account (blocked/rejected users could
--    still accept proposals or cancel through PostgREST).
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_appointment_proposal(
  p_proposal_id uuid,
  p_client_id uuid,
  p_accepted boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_proposal public.appointment_proposals%rowtype;
  v_request public.booking_requests%rowtype;
  v_appointment_id uuid;
begin
  if p_client_id <> auth.uid() or not public.is_approved_client() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.appointment_proposals
  where id = p_proposal_id
  for update;

  if not found or v_proposal.status <> 'sent' or v_proposal.starts_at <= now() then
    raise exception 'proposal is closed' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.booking_requests
  where id = v_proposal.request_id
  for update;

  if not found or v_request.client_id <> p_client_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_accepted then
    insert into public.appointments(request_id, proposal_id, client_id, barber_id, service_id, starts_at, ends_at)
    values (v_request.id, v_proposal.id, p_client_id, v_proposal.barber_id, v_request.service_id, v_proposal.starts_at, v_proposal.ends_at)
    returning id into v_appointment_id;
  end if;

  update public.appointment_proposals
  set status = case when p_accepted then 'accepted'::public.proposal_status else 'declined'::public.proposal_status end
  where id = v_proposal.id;

  update public.booking_requests
  set status = case when p_accepted then 'confirmed'::public.request_status else 'declined'::public.request_status end,
      updated_at = now()
  where id = v_request.id;

  return v_appointment_id;
end;
$$;

create or replace function public.client_cancel_confirmed_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
begin
  select * into v_appt
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found or v_appt.client_id is null or v_appt.client_id <> auth.uid()
     or not public.is_approved_client() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_appt.status <> 'confirmed' then
    raise exception 'appointment is not cancellable' using errcode = 'P0001';
  end if;

  if v_appt.starts_at <= now() + interval '24 hours' then
    raise exception 'too late to cancel' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled', outcome = 'cancelled'
  where id = v_appt.id;

  if v_appt.request_id is not null then
    update public.booking_requests
    set status = 'cancelled', updated_at = now()
    where id = v_appt.request_id;
  end if;

  return v_appt.request_id;
end;
$$;

create or replace function public.client_cancel_request(p_request_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.booking_requests%rowtype;
begin
  select * into v_request
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found or v_request.client_id <> auth.uid() or not public.is_approved_client() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_request.status not in ('pending', 'proposed') then
    raise exception 'request is not cancellable' using errcode = 'P0001';
  end if;

  update public.appointment_proposals
  set status = 'expired'
  where request_id = v_request.id and status = 'sent';

  update public.booking_requests
  set status = 'cancelled', updated_at = now()
  where id = v_request.id;

  return v_request.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Revoke the implicit PUBLIC/anon execute left on earlier helpers
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.confirm_booking_request(uuid, uuid) from public, anon;
revoke execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean) from public, anon;
revoke execute on function public.record_admin_action(text, text, text, jsonb) from public, anon;
revoke execute on function public.has_confirmed_appointment_overlap(uuid, timestamptz, timestamptz, uuid) from public, anon;

-- The picker only needs upcoming busy slots, never the whole history. The
-- return shape gains an id column, so the old function must be dropped first
-- (Postgres cannot alter a RETURNS TABLE signature in place).
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
    and a.ends_at >= now() - interval '1 day'
  order by a.starts_at;
$$;
revoke execute on function public.confirmed_appointment_slots() from public, anon;
grant execute on function public.confirmed_appointment_slots() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. phone_taken: service role only (the app calls it with the admin client)
-- ---------------------------------------------------------------------------
revoke execute on function public.phone_taken(text) from public, anon, authenticated;
grant execute on function public.phone_taken(text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Storage limits and push subscription ownership
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('avatars', 'service-images');

-- Reassigning an endpoint that a previous user of the same browser registered
-- fails under the owner-only UPDATE policy, so the old owner keeps receiving
-- pushes on a device they no longer use. The RPC performs the upsert as the
-- definer and always binds the endpoint to the caller.
create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_expiration timestamptz,
  p_user_agent text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if length(p_endpoint) > 4096 or length(p_p256dh) > 4096 or length(p_auth) > 4096 then
    raise exception 'invalid subscription' using errcode = 'P0001';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, expiration_time, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_expiration, left(p_user_agent, 500))
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        expiration_time = excluded.expiration_time,
        user_agent = excluded.user_agent,
        enabled = true,
        failure_count = 0,
        last_failure_at = null;
end;
$$;
revoke execute on function public.upsert_push_subscription(text, text, text, timestamptz, text) from public, anon;
grant execute on function public.upsert_push_subscription(text, text, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Calendar feed: rotation + approval gate
-- ---------------------------------------------------------------------------
create or replace function public.calendar_feed(p_token uuid)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, service_name text, customer text)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.starts_at,
    a.ends_at,
    s.name as service_name,
    coalesce(p.full_name, a.customer_name, 'Walk-in') as customer
  from public.profiles owner
  join public.appointments a
    on owner.role = 'admin' or a.client_id = owner.id
  join public.services s on s.id = a.service_id
  left join public.profiles p on p.id = a.client_id
  where owner.calendar_token = p_token
    and owner.approval_status = 'approved'
    and a.status = 'confirmed'
    and a.starts_at >= now() - interval '30 days'
  order by a.starts_at;
$$;

-- The privileged-column guard (0025) refuses calendar_token changes carrying a
-- user JWT. Rotation is legitimate for the owner, so the guard honours a
-- transaction-local flag that only this function sets.
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
    or new.calendar_token is distinct from old.calendar_token;

  if not v_privileged_change then
    return new;
  end if;

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

create or replace function public.rotate_my_calendar_token()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform set_config('app.rotate_calendar_token', 'on', true);
  update public.profiles
  set calendar_token = gen_random_uuid()
  where id = auth.uid()
  returning calendar_token into v_token;
  perform set_config('app.rotate_calendar_token', 'off', true);
  return v_token;
end;
$$;
revoke execute on function public.rotate_my_calendar_token() from public, anon;
grant execute on function public.rotate_my_calendar_token() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Erasure: notifications keep no personal data after the profile is gone
-- ---------------------------------------------------------------------------
create or replace function public.scrub_notifications_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
  where user_id = old.id
     or lower(recipient) = lower(old.email);
  return old;
end;
$$;
revoke execute on function public.scrub_notifications_on_profile_delete() from public, anon, authenticated;

drop trigger if exists profiles_scrub_notifications on public.profiles;
create trigger profiles_scrub_notifications
before delete on public.profiles
for each row execute function public.scrub_notifications_on_profile_delete();

-- A client may only write a notification addressed to themselves; the barber's
-- rows come from the service-role client.
drop policy if exists "notifications self or admin insert" on public.notifications;
create policy "notifications self or admin insert"
on public.notifications for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and lower(recipient) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- ---------------------------------------------------------------------------
-- 8. Invariants and indexes
-- ---------------------------------------------------------------------------
create unique index if not exists appointment_proposals_one_sent_per_request
  on public.appointment_proposals (request_id)
  where status = 'sent';

create index if not exists appointments_client_start_idx
  on public.appointments (client_id, starts_at desc);
create index if not exists appointments_request_idx
  on public.appointments (request_id);
create index if not exists appointments_status_start_idx
  on public.appointments (status, starts_at);
create index if not exists booking_requests_client_status_idx
  on public.booking_requests (client_id, status);
create index if not exists booking_requests_status_start_idx
  on public.booking_requests (status, requested_start);
create index if not exists appointment_proposals_request_status_idx
  on public.appointment_proposals (request_id, status);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_recipient_created_idx
  on public.notifications (lower(recipient), created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Sign-up trigger: canonical phone, bounded lengths, null-safe email
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := coalesce(new.email, new.id::text || '@unknown.invalid');
begin
  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)), 120),
    v_email,
    nullif(left(public.normalize_phone(new.raw_user_meta_data ->> 'phone'), 40), ''),
    new.email_confirmed_at
  );
  return new;
end;
$$;
