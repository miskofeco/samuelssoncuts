-- Wire up RLS for business_hours (table exists from 0001 but had no policies).
-- Also adds a `closed` column so a whole day can be marked as closed without
-- needing a blocked_time entry.

alter table public.business_hours
  add column if not exists closed boolean not null default false;

-- Anyone can read business hours (needed for client-side slot generation).
create policy "business_hours public read"
  on public.business_hours for select
  using (true);

-- Only the owning admin can write their own hours.
create policy "business_hours admin insert"
  on public.business_hours for insert
  to authenticated
  with check (barber_id = auth.uid() and is_admin());

create policy "business_hours admin update"
  on public.business_hours for update
  to authenticated
  using  (barber_id = auth.uid() and is_admin())
  with check (barber_id = auth.uid() and is_admin());

create policy "business_hours admin delete"
  on public.business_hours for delete
  to authenticated
  using (barber_id = auth.uid() and is_admin());
