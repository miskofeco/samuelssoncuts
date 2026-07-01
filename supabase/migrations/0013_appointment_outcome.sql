-- Track whether a past appointment was completed, a no-show, or cancelled.
-- NULL = upcoming / outcome not yet recorded (default for all existing rows).
create type public.appointment_outcome as enum ('completed', 'no_show', 'cancelled');

alter table public.appointments
  add column if not exists outcome public.appointment_outcome;
