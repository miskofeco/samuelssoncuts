-- Track whether a 24-hour reminder has been sent for each appointment, so the
-- cron job never double-sends even if it runs twice in the same window.
alter table public.appointments
  add column if not exists reminded_at timestamptz;

-- Index for the cron query: find appointments in the upcoming 23–25 h window
-- that haven't been reminded yet.
create index if not exists appointments_reminder_idx
  on public.appointments (starts_at)
  where reminded_at is null;
