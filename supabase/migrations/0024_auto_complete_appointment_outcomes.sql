-- Speed up the cron sweep that marks finished confirmed appointments as
-- completed after the no-show grace period.
create index if not exists appointments_auto_complete_outcome_idx
  on public.appointments (ends_at)
  where status = 'confirmed' and outcome is null;
