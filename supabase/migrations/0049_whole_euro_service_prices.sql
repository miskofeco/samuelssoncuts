-- Service prices are whole euros. Round any existing half-euro (or other
-- fractional) catalog price to the nearest euro, halves up, and keep new
-- catalog writes whole. Surcharged quotes are rounded to whole euros in the
-- app (`priceCentsForSlot`). Booking requests and appointments keep their
-- captured price snapshots untouched: historical amounts are not rewritten.
update public.services
set price_cents = round(price_cents / 100.0) * 100,
    sunday_price_cents = round(sunday_price_cents / 100.0) * 100
where price_cents % 100 <> 0
   or sunday_price_cents % 100 <> 0;

alter table public.services
  add constraint services_price_cents_whole_euro check (price_cents % 100 = 0),
  add constraint services_sunday_price_cents_whole_euro check (sunday_price_cents % 100 = 0);
