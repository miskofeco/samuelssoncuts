-- Cache identity checks once per statement without changing policy roles, commands,
-- ownership predicates, or WITH CHECK rules. Abort if the policy set has drifted.
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
  ) <> '606084df47ee880ee35fd4f44728a629' then
    raise exception 'Public RLS policies differ from the reviewed baseline';
  end if;
end;
$$;

alter policy "proposals own or admin read" on public.appointment_proposals
  using (
    (select is_admin()) or exists (
      select 1 from public.booking_requests
      where booking_requests.id = appointment_proposals.request_id
        and booking_requests.client_id = (select auth.uid())
    )
  );

alter policy "appointments own or admin read" on public.appointments
  using (client_id = (select auth.uid()) or (select is_admin()));

alter policy "preferences own insert" on public.booking_preferences
  with check (
    exists (
      select 1 from public.booking_requests
      where booking_requests.id = booking_preferences.request_id
        and booking_requests.client_id = (select auth.uid())
    )
  );

alter policy "preferences own or admin read" on public.booking_preferences
  using (
    (select is_admin()) or exists (
      select 1 from public.booking_requests
      where booking_requests.id = booking_preferences.request_id
        and booking_requests.client_id = (select auth.uid())
    )
  );

alter policy "booking requests own or admin read" on public.booking_requests
  using (client_id = (select auth.uid()) or (select is_admin()));

alter policy "business_hours admin delete" on public.business_hours
  using (barber_id = (select auth.uid()) and (select is_admin()));

alter policy "business_hours admin insert" on public.business_hours
  with check (barber_id = (select auth.uid()) and (select is_admin()));

alter policy "business_hours admin update" on public.business_hours
  using (barber_id = (select auth.uid()) and (select is_admin()))
  with check (barber_id = (select auth.uid()) and (select is_admin()));

alter policy "cookie_consents self insert" on public.cookie_consents
  with check (user_id = (select auth.uid()));

alter policy "cookie_consents self read" on public.cookie_consents
  using (user_id = (select auth.uid()) or (select is_admin()));

alter policy "notifications own or admin read" on public.notifications
  using (
    (select is_admin())
    or user_id = (select auth.uid())
    or recipient = ((select auth.jwt()) ->> 'email'::text)
  );

alter policy "notifications own update" on public.notifications
  using (
    user_id = (select auth.uid())
    or recipient = ((select auth.jwt()) ->> 'email'::text)
  )
  with check (
    user_id = (select auth.uid())
    or recipient = ((select auth.jwt()) ->> 'email'::text)
  );

alter policy "notifications self or admin insert" on public.notifications
  with check (
    (select is_admin())
    or (
      user_id = (select auth.uid())
      and lower(recipient) = lower(coalesce(((select auth.jwt()) ->> 'email'::text), ''::text))
    )
  );

alter policy "pricing_settings admin insert" on public.pricing_settings
  with check ((select is_admin()) and barber_id = (select auth.uid()));

alter policy "pricing_settings admin update" on public.pricing_settings
  using ((select is_admin()) and barber_id = (select auth.uid()))
  with check ((select is_admin()) and barber_id = (select auth.uid()));

alter policy "profiles self or admin read" on public.profiles
  using (id = (select auth.uid()) or (select is_admin()));

alter policy "profiles self update" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'client'::user_role);

alter policy "push_subscriptions own delete" on public.push_subscriptions
  using (user_id = (select auth.uid()));

alter policy "push_subscriptions own insert" on public.push_subscriptions
  with check (user_id = (select auth.uid()));

alter policy "push_subscriptions own read" on public.push_subscriptions
  using (user_id = (select auth.uid()));

alter policy "push_subscriptions own update" on public.push_subscriptions
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
