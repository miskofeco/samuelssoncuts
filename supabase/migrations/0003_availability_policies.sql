-- Make blocked_times usable. It had RLS enabled in 0001 but no policies, so
-- nobody could read or write it. The admin manages vacation / blocked days, and
-- clients need read access so the booking picker can disable those dates.

drop policy if exists "blocked times admin write" on public.blocked_times;
drop policy if exists "blocked times authenticated read" on public.blocked_times;

create policy "blocked times admin write"
on public.blocked_times for all
using (public.is_admin())
with check (public.is_admin());

create policy "blocked times authenticated read"
on public.blocked_times for select
to authenticated
using (true);
