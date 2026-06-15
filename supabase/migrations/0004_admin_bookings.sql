-- Let the barber create appointments directly from the admin calendar, for
-- either an existing client or a walk-in identified only by name. The original
-- appointments table assumed the client-request flow, so it required a
-- booking_requests row (request_id) and a profiles row (client_id). A
-- barber-created booking has neither, so relax both and add customer_name.

alter table public.appointments
  alter column request_id drop not null;

alter table public.appointments
  alter column client_id drop not null;

alter table public.appointments
  add column if not exists customer_name text;

-- Every appointment must still identify a customer: either a registered client
-- (client_id) or a typed walk-in name (customer_name).
alter table public.appointments
  add constraint appointments_customer_present
  check (client_id is not null or customer_name is not null);

-- No RLS change needed: the existing "appointments admin write" policy
-- (for all using/with check public.is_admin()) already permits these inserts,
-- and the appointments_unique_start index still blocks double-booking.
