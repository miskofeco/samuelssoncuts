-- The app's PostgREST overlap check uses scalar starts_at/ends_at filters,
-- not a tstzrange expression. A B-tree prefix is usable for barber + start.
drop index if exists public.blocked_times_barber_range_idx;
create index if not exists blocked_times_barber_start_end_idx
  on public.blocked_times (barber_id, starts_at, ends_at);
