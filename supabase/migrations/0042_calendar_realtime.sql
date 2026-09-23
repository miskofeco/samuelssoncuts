-- Realtime is an invalidation signal only. Clients continue to read sanitized
-- busy slots through the booking endpoint; table RLS governs event delivery.
-- Keep profiles out of the publication so calendar feed tokens are never sent
-- as part of a profile change payload.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointments',
    'booking_requests',
    'appointment_proposals',
    'blocked_times',
    'services'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
