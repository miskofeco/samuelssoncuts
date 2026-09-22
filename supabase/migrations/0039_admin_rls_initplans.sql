-- is_admin() is STABLE and takes no row input, so evaluate it once per query.
-- Keep every existing policy name, role, command, and predicate unchanged.
do $$
begin
  if (
    select md5(string_agg(
      tablename || '|' || policyname || '|' || cmd || '|' || roles::text || '|'
      || coalesce(qual, '<null>') || '|' || coalesce(with_check, '<null>'),
      E'\n' order by tablename, policyname
    ))
    from pg_policies
    where schemaname = 'public'
  ) <> '5b39b992a933f53c7804fa3c6198ec66' then
    raise exception 'Public RLS policies differ from the reviewed post-0038 baseline';
  end if;
end;
$$;

alter policy "admin_audit_log admin read" on public.admin_audit_log
  using ((select is_admin()));

alter policy "proposals admin write" on public.appointment_proposals
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "appointments admin write" on public.appointments
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "blocked times admin write" on public.blocked_times
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "booking requests admin update" on public.booking_requests
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "profiles admin update" on public.profiles
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "services admin write" on public.services
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "services authenticated read" on public.services
  using (active = true or (select is_admin()));
