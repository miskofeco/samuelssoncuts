-- Launch hardening: appointment privacy, rate limiting, and transactional
-- booking confirmation paths.

-- Clients may read their own raw appointments; admins may read all raw rows.
drop policy if exists "appointments authenticated availability read" on public.appointments;
drop policy if exists "appointments own or admin read" on public.appointments;

create policy "appointments own or admin read"
on public.appointments for select
to authenticated
using (client_id = auth.uid() or public.is_admin());

-- The public booking picker needs busy slots, not raw appointment records.
create or replace function public.confirmed_appointment_slots()
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  service_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select a.starts_at, a.ends_at, a.service_id
  from public.appointments a
  where a.status = 'confirmed'
  order by a.starts_at;
$$;

grant execute on function public.confirmed_appointment_slots() to authenticated;

create or replace function public.has_confirmed_appointment_overlap(
  p_barber_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_appointment_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    where a.status = 'confirmed'
      and (p_barber_id is null or a.barber_id = p_barber_id)
      and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
      and a.starts_at < p_end
      and a.ends_at > p_start
  );
$$;

grant execute on function public.has_confirmed_appointment_overlap(uuid, timestamptz, timestamptz, uuid) to authenticated;

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz := now() + make_interval(secs => p_window_seconds);
  v_count integer;
begin
  if p_key is null or length(trim(p_key)) = 0 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.rate_limits(key, count, reset_at)
  values (p_key, 1, v_reset_at)
  on conflict (key) do update
  set count = case
      when public.rate_limits.reset_at <= v_now then 1
      else public.rate_limits.count + 1
    end,
    reset_at = case
      when public.rate_limits.reset_at <= v_now then v_reset_at
      else public.rate_limits.reset_at
    end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

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
  if not public.is_admin() or p_barber_id <> auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_request
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
    request_id,
    client_id,
    barber_id,
    service_id,
    starts_at,
    ends_at
  )
  values (
    v_request.id,
    v_request.client_id,
    p_barber_id,
    v_request.service_id,
    v_request.requested_start,
    v_request.requested_end
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set status = 'confirmed',
      updated_at = now()
  where id = v_request.id;

  update public.booking_requests
  set status = 'declined',
      updated_at = now()
  where status = 'pending'
    and requested_start = v_request.requested_start
    and id <> v_request.id;

  return v_appointment_id;
end;
$$;

grant execute on function public.confirm_booking_request(uuid, uuid) to authenticated;

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
  if p_client_id <> auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_proposal
  from public.appointment_proposals
  where id = p_proposal_id
  for update;

  if not found or v_proposal.status <> 'sent' or v_proposal.starts_at <= now() then
    raise exception 'proposal is closed' using errcode = 'P0001';
  end if;

  select *
  into v_request
  from public.booking_requests
  where id = v_proposal.request_id
  for update;

  if not found or v_request.client_id <> p_client_id then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_accepted then
    insert into public.appointments(
      request_id,
      proposal_id,
      client_id,
      barber_id,
      service_id,
      starts_at,
      ends_at
    )
    values (
      v_request.id,
      v_proposal.id,
      p_client_id,
      v_proposal.barber_id,
      v_request.service_id,
      v_proposal.starts_at,
      v_proposal.ends_at
    )
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

grant execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean) to authenticated;
