create table public.pricing_settings (
  barber_id uuid primary key references public.profiles(id) on delete cascade,
  gap_surcharge_percent integer not null default 10 check (gap_surcharge_percent between 0 and 500),
  vip_surcharge_percent integer not null default 20 check (vip_surcharge_percent between 0 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pricing_settings enable row level security;

create trigger pricing_settings_touch_updated_at
before update on public.pricing_settings
for each row execute function public.touch_updated_at();

create policy "pricing_settings authenticated read"
on public.pricing_settings for select
to authenticated
using (true);

create policy "pricing_settings admin insert"
on public.pricing_settings for insert
with check (public.is_admin() and barber_id = auth.uid());

create policy "pricing_settings admin update"
on public.pricing_settings for update
using (public.is_admin() and barber_id = auth.uid())
with check (public.is_admin() and barber_id = auth.uid());
