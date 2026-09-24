create table public.booking_contact_settings (
  barber_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null check (char_length(btrim(address)) between 5 and 240),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_contact_settings enable row level security;

create trigger booking_contact_settings_touch_updated_at
before update on public.booking_contact_settings
for each row execute function public.touch_updated_at();

grant select on public.booking_contact_settings to authenticated;
grant insert, update on public.booking_contact_settings to authenticated;

create policy "booking contact authenticated read"
on public.booking_contact_settings for select
to authenticated
using (true);

create policy "booking contact barber insert"
on public.booking_contact_settings for insert
to authenticated
with check ((select public.is_admin()) and barber_id = (select auth.uid()));

create policy "booking contact barber update"
on public.booking_contact_settings for update
to authenticated
using ((select public.is_admin()) and barber_id = (select auth.uid()))
with check ((select public.is_admin()) and barber_id = (select auth.uid()));
