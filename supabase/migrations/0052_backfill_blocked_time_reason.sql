-- Blocks created before reasons were required get the reason "Voľno" so the
-- admin calendar and the blocked-periods list can label them. Only missing,
-- blank or too-short reasons are replaced; an existing reason is kept.
-- The reason column is not in the blocked-time guard trigger's column list,
-- so this update does not re-check appointment conflicts.
update public.blocked_times
set reason = 'Voľno'
where reason is null or char_length(btrim(reason)) < 2;

-- With every row compliant, promote the 0051 check from NOT VALID to fully
-- validated. A legacy reason longer than 40 characters is left untouched and
-- keeps the check NOT VALID rather than truncating the barber's note.
do $$
begin
  if not exists (
    select 1 from public.blocked_times where char_length(btrim(reason)) > 40
  ) then
    alter table public.blocked_times validate constraint blocked_times_reason_short;
  else
    raise notice 'blocked_times_reason_short left NOT VALID: a legacy reason is longer than 40 characters';
  end if;
end;
$$;
