-- Booking rework: the client now picks an EXACT date + time for the chosen
-- service (instead of three day-window preferences). That choice is stored on
-- the booking_request itself, along with the price computed at booking time
-- (base, or +10% when the slot leaves a gap before it — the "must extend one
-- tight block" rule). The request stays status = 'pending' until the barber
-- confirms it (one click → a confirmed appointment) or proposes another time
-- (existing proposal flow, unchanged).

alter table public.booking_requests
  add column if not exists requested_start timestamptz,
  add column if not exists requested_end timestamptz,
  add column if not exists price_cents integer,
  add column if not exists surcharge boolean not null default false;

-- The booking_preferences table is left in place (no destructive drop) but is
-- no longer written to by the new flow — kept only so any legacy rows survive.
-- request_status reuses 'pending' for "client picked, barber must confirm";
-- 'proposed' still means the barber proposed an alternative time.
