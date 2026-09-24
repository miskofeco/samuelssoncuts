-- Close the client-callable proposal RPC's null-ownership gap and make the
-- database enforce the same shop availability rules as the server action.
-- The shop's configured time zone is Europe/Bratislava (the app default).
create or replace function public.respond_to_appointment_proposal(
  p_proposal_id uuid,
  p_client_id uuid,
  p_accepted boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_request public.booking_requests%rowtype;
  v_proposal public.appointment_proposals%rowtype;
  v_hours public.business_hours%rowtype;
  v_local_start timestamp;
  v_local_end timestamp;
  v_today date;
  v_appointment_id uuid;
begin
  -- IS DISTINCT FROM is deliberate: SQL's <> returns NULL for a NULL input.
  if auth.uid() is null
     or p_client_id is distinct from auth.uid()
     or p_accepted is null
     or not public.is_approved_client() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Lock in the same request-then-proposal order as cancellation paths.
  select request_id into v_request_id
  from public.appointment_proposals
  where id = p_proposal_id;
  if not found then
    raise exception 'proposal is closed' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.booking_requests
  where id = v_request_id
  for update;
  if not found or v_request.client_id is distinct from auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.appointment_proposals
  where id = p_proposal_id
  for update;
  if not found
     or v_proposal.request_id is distinct from v_request.id
     or v_proposal.status <> 'sent'
     or v_request.status <> 'proposed'
     or v_request.selected_proposal_id is distinct from v_proposal.id
     or v_proposal.starts_at <= now() then
    raise exception 'proposal is closed' using errcode = 'P0001';
  end if;

  if p_accepted then
    if v_proposal.ends_at <= v_proposal.starts_at
       or not exists (
         select 1 from public.profiles
         where id = v_proposal.barber_id
           and role = 'admin'
           and approval_status = 'approved'
           and is_shop_barber
       ) then
      raise exception 'proposal is unavailable' using errcode = 'P0001';
    end if;

    v_local_start := v_proposal.starts_at at time zone 'Europe/Bratislava';
    v_local_end := v_proposal.ends_at at time zone 'Europe/Bratislava';
    v_today := (now() at time zone 'Europe/Bratislava')::date;
    if v_local_start::date < v_today
       or v_local_start::date > v_today + 14 then
      raise exception 'proposal is outside the booking window' using errcode = 'P0001';
    end if;

    -- A missing business_hours row uses 07:00-21:00, closed Sunday, matching
    -- the booking picker and guardSlot.
    select * into v_hours
    from public.business_hours
    where barber_id = v_proposal.barber_id
      and weekday = extract(dow from v_local_start)::integer;
    if v_local_end::date is distinct from v_local_start::date
       or (
         found and (
           v_hours.closed
           or v_local_start::time < v_hours.opens_at
           or v_local_end::time > v_hours.closes_at
         )
       )
       or (
         not found and (
           extract(dow from v_local_start) = 0
           or v_local_start::time < time '07:00'
           or v_local_end::time > time '21:00'
         )
       ) then
      raise exception 'proposal is outside business hours' using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.blocked_times
      where barber_id = v_proposal.barber_id
        and starts_at < v_proposal.ends_at
        and ends_at > v_proposal.starts_at
    ) then
      raise exception 'proposal overlaps blocked time' using errcode = 'P0001';
    end if;

    if public.has_confirmed_appointment_overlap(
      v_proposal.barber_id, v_proposal.starts_at, v_proposal.ends_at, null
    ) then
      raise exception 'proposal overlaps an appointment' using errcode = 'P0001';
    end if;

    -- The exclusion constraint remains the final concurrency guard against
    -- two accepted bookings racing for the same barber and time.
    insert into public.appointments(
      request_id, proposal_id, client_id, barber_id, service_id, starts_at, ends_at
    ) values (
      v_request.id, v_proposal.id, auth.uid(), v_proposal.barber_id,
      v_request.service_id, v_proposal.starts_at, v_proposal.ends_at
    ) returning id into v_appointment_id;
  end if;

  update public.appointment_proposals
  set status = case when p_accepted then 'accepted'::public.proposal_status
                    else 'declined'::public.proposal_status end
  where id = v_proposal.id;

  update public.booking_requests
  set status = case when p_accepted then 'confirmed'::public.request_status
                    else 'declined'::public.request_status end,
      updated_at = now()
  where id = v_request.id;

  return v_appointment_id;
end;
$$;
revoke execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean) to authenticated;

-- Protect the delivery worker even when a caller writes directly through the
-- Data API. Existing rows are checked when the constraint is added; there are
-- no invalid endpoints in the current project as of this migration.
alter table public.push_subscriptions
  add constraint push_subscriptions_safe_endpoint check (
    length(endpoint) <= 4096
    and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])+push[.]apple[.]com)/[^?#[:space:][:cntrl:]]+$'
  ),
  add constraint push_subscriptions_key_lengths check (
    length(p256dh) between 1 and 4096
    and length(auth) between 1 and 4096
  );

-- Count every stored device, including disabled ones, so direct writes cannot
-- accumulate unbounded rows. The transaction lock serializes simultaneous
-- registrations for the same user, including calls through the upsert RPC.
create or replace function public.limit_push_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_owner uuid;
  v_count integer;
begin
  if tg_op = 'INSERT' then
    select user_id into v_existing_owner
    from public.push_subscriptions
    where endpoint = new.endpoint;
    if v_existing_owner is not distinct from new.user_id then
      return new;
    end if;
  elsif new.user_id is not distinct from old.user_id then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 430043)
  );
  select count(*) into v_count
  from public.push_subscriptions
  where user_id = new.user_id;
  if v_count >= 8 then
    raise exception 'subscription limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger push_subscriptions_limit_per_user
before insert or update of user_id on public.push_subscriptions
for each row execute function public.limit_push_subscriptions();

-- This function is trigger-only; no API role needs direct execution.
revoke execute on function public.limit_push_subscriptions() from public, anon, authenticated;

-- Reconcile grants that remained callable by anon in the deployed database.
-- The cancellation functions already validate auth internally; the revokes
-- remove the unnecessary anonymous entry points.
revoke execute on function public.admin_cancel_appointment(uuid, boolean) from public, anon;
revoke execute on function public.client_cancel_request(uuid) from public, anon;
revoke execute on function public.client_cancel_confirmed_appointment(uuid) from public, anon;

-- Both helpers resolve only built-in functions and schema-qualified tables.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(btrim(coalesce(p_phone, '')), '[[:space:]\\-().]', '', 'g'),
    '^00',
    '+'
  );
$$;
revoke execute on function public.normalize_phone(text) from public, anon, authenticated;
