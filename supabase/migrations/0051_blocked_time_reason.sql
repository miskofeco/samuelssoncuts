-- Every new block carries a short reason (a few words) that the admin
-- calendar and the blocked-periods list display. NOT VALID keeps older rows
-- without a reason readable and deletable; the app never updates block rows,
-- and every new insert or update must satisfy the rule.
alter table public.blocked_times
  add constraint blocked_times_reason_short
  check (reason is not null and char_length(btrim(reason)) between 2 and 40)
  not valid;
