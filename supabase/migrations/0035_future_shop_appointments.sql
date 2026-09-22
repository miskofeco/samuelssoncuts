-- Keep future client bookings visible and reserved when a former admin-created
-- appointment was stored under that admin instead of the sole shop barber.
-- Past appointments remain untouched for historical accuracy.
do $$
declare
  v_shop_barber_id uuid;
  v_appt public.appointments%rowtype;
begin
  select id into v_shop_barber_id
  from public.profiles
  where is_shop_barber and role = 'admin' and approval_status = 'approved';

  if v_shop_barber_id is null then
    raise exception 'shop barber is not configured';
  end if;

  for v_appt in
    select * from public.appointments
    where status = 'confirmed'
      and starts_at > now()
      and barber_id <> v_shop_barber_id
    order by starts_at
    for update
  loop
    if public.has_confirmed_appointment_overlap(
      v_shop_barber_id, v_appt.starts_at, v_appt.ends_at, v_appt.id
    ) then
      raise exception 'future appointment conflicts with shop barber schedule';
    end if;

    if exists (
      select 1 from public.blocked_times b
      where b.barber_id = v_shop_barber_id
        and b.starts_at < v_appt.ends_at
        and b.ends_at > v_appt.starts_at
    ) then
      raise exception 'future appointment conflicts with shop barber blocked time';
    end if;

    update public.appointments
    set barber_id = v_shop_barber_id
    where id = v_appt.id
      and status = 'confirmed'
      and starts_at > now();
  end loop;

  -- A sent proposal that is accepted later must also create a shop booking.
  update public.appointment_proposals
  set barber_id = v_shop_barber_id
  where status = 'sent'
    and starts_at > now()
    and barber_id <> v_shop_barber_id;
end;
$$;
