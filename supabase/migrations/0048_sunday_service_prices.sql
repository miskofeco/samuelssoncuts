-- Sunday is priced separately: every service carries a barber-set Sunday list
-- price next to its regular (Monday–Saturday) price. Booking rules do not
-- change; the server quote picks the base price by the shop-local day and
-- applies the usual gap/VIP surcharges on top. Existing services start with a
-- Sunday price equal to their current price so no quote changes until the
-- barber edits it.
alter table public.services
  add column sunday_price_cents integer;

update public.services
set sunday_price_cents = price_cents
where sunday_price_cents is null;

alter table public.services
  alter column sunday_price_cents set not null,
  add constraint services_sunday_price_cents_nonnegative check (sunday_price_cents >= 0);

-- The appointment price snapshot falls back to the catalog only when neither
-- the insert nor its request supplied a price. Use the Sunday price when the
-- appointment starts on a shop-local Sunday so the fallback matches the quote.
create or replace function public.appointments_snapshot_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price_cents is null then
    new.price_cents := coalesce(
      (select r.price_cents from public.booking_requests r where r.id = new.request_id),
      (
        select case
          when extract(dow from (new.starts_at at time zone 'Europe/Bratislava')) = 0
            then s.sunday_price_cents
          else s.price_cents
        end
        from public.services s
        where s.id = new.service_id
      )
    );
  end if;
  if new.price_cents is null or new.price_cents < 0 then
    raise exception 'appointment price is required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
