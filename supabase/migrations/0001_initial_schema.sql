create extension if not exists pgcrypto;

create type public.user_role as enum ('client', 'admin');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.request_status as enum ('pending', 'proposed', 'confirmed', 'declined', 'cancelled');
create type public.proposal_status as enum ('sent', 'accepted', 'declined', 'expired');
create type public.notification_channel as enum ('email', 'sms');
create type public.day_window as enum ('Morning', 'Midday', 'Afternoon', 'Evening');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  approval_status public.approval_status not null default 'pending',
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.profiles(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  unique (barber_id, weekday)
);

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  note text,
  status public.request_status not null default 'pending',
  selected_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_preferences (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  preferred_date date not null,
  day_window public.day_window not null,
  unique (request_id, rank)
);

create table public.appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  barber_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  status public.proposal_status not null default 'sent',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.booking_requests
  add constraint booking_requests_selected_proposal_id_fkey
  foreign key (selected_proposal_id) references public.appointment_proposals(id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id),
  proposal_id uuid references public.appointment_proposals(id),
  client_id uuid not null references public.profiles(id),
  barber_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index appointments_unique_start
  on public.appointments (barber_id, starts_at)
  where status = 'confirmed';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel public.notification_channel not null,
  recipient text not null,
  subject text not null,
  body text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger booking_requests_touch_updated_at
before update on public.booking_requests
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
  );
$$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_preferences enable row level security;
alter table public.appointment_proposals enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;

create policy "profiles self or admin read"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles self update"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'client');

create policy "profiles admin update"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

create policy "services authenticated read"
on public.services for select
to authenticated
using (active = true or public.is_admin());

create policy "services admin write"
on public.services for all
using (public.is_admin())
with check (public.is_admin());

create policy "booking requests own or admin read"
on public.booking_requests for select
using (client_id = auth.uid() or public.is_admin());

create policy "booking requests approved client insert"
on public.booking_requests for insert
with check (
  client_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
  )
);

create policy "booking requests admin update"
on public.booking_requests for update
using (public.is_admin())
with check (public.is_admin());

create policy "booking requests client status update"
on public.booking_requests for update
using (client_id = auth.uid())
with check (client_id = auth.uid());

create policy "preferences own or admin read"
on public.booking_preferences for select
using (
  public.is_admin()
  or exists (
    select 1 from public.booking_requests
    where booking_requests.id = booking_preferences.request_id
      and booking_requests.client_id = auth.uid()
  )
);

create policy "preferences own insert"
on public.booking_preferences for insert
with check (
  exists (
    select 1 from public.booking_requests
    where booking_requests.id = booking_preferences.request_id
      and booking_requests.client_id = auth.uid()
  )
);

create policy "proposals own or admin read"
on public.appointment_proposals for select
using (
  public.is_admin()
  or exists (
    select 1 from public.booking_requests
    where booking_requests.id = appointment_proposals.request_id
      and booking_requests.client_id = auth.uid()
  )
);

create policy "proposals admin write"
on public.appointment_proposals for all
using (public.is_admin())
with check (public.is_admin());

create policy "proposals client update own"
on public.appointment_proposals for update
using (
  exists (
    select 1 from public.booking_requests
    where booking_requests.id = appointment_proposals.request_id
      and booking_requests.client_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.booking_requests
    where booking_requests.id = appointment_proposals.request_id
      and booking_requests.client_id = auth.uid()
  )
);

create policy "appointments authenticated availability read"
on public.appointments for select
to authenticated
using (true);

create policy "appointments admin write"
on public.appointments for all
using (public.is_admin())
with check (public.is_admin());

create policy "appointments client insert own accepted"
on public.appointments for insert
with check (client_id = auth.uid());

create policy "notifications own or admin read"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

create policy "notifications authenticated insert"
on public.notifications for insert
to authenticated
with check (true);

insert into public.services (name, description, duration_minutes, price_cents)
values
  ('Signature cut', 'Detailed haircut with consultation and styling.', 45, 3200),
  ('Beard shape', 'Beard trim, shape, and hot towel finish.', 30, 2000),
  ('Cut + beard', 'Full haircut and beard service.', 75, 4800);
