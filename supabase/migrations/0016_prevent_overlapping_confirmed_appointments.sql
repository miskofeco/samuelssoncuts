-- Prevent double-booking at the database boundary. Application code pre-checks
-- availability for clear user feedback, but this exclusion constraint is the
-- race-condition backstop for simultaneous inserts or API/action bypasses.

create extension if not exists btree_gist;

do $$
begin
  if exists (
    select 1
    from public.appointments a
    join public.appointments b
      on a.id < b.id
     and a.barber_id = b.barber_id
     and a.status = 'confirmed'
     and b.status = 'confirmed'
     and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
  ) then
    raise exception
      'Cannot add appointments_no_confirmed_overlap: existing confirmed appointments overlap';
  end if;
end
$$;

alter table public.appointments
  drop constraint if exists appointments_no_confirmed_overlap;

alter table public.appointments
  add constraint appointments_no_confirmed_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'confirmed');
