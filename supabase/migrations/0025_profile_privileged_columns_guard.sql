-- Close the privilege-escalation hole in "profiles self update" (0001): the
-- policy lets a signed-in user UPDATE their own row, and its WITH CHECK only
-- pins `role = 'client'`. That left approval_status, email, email_confirmed_at
-- and calendar_token writable by the account owner, so a pending or blocked
-- client could approve themselves through PostgREST.
--
-- A BEFORE UPDATE trigger is used instead of a column-level grant because the
-- app legitimately updates these columns from three places: admins (through
-- RLS + is_admin()), the service-role client (cron, account deletion), and the
-- auth.users -> profiles sync triggers from 0001/0002 (which run without a JWT,
-- so auth.uid() is null). Everything else that carries a user JWT is refused.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_privileged_change boolean;
begin
  v_privileged_change :=
    new.role is distinct from old.role
    or new.approval_status is distinct from old.approval_status
    or new.email is distinct from old.email
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.calendar_token is distinct from old.calendar_token;

  if not v_privileged_change then
    return new;
  end if;

  -- Internal contexts (auth triggers, service role, migrations) carry no user
  -- JWT. Anything with a user JWT must be an approved admin.
  if auth.uid() is null
     or coalesce(current_setting('role', true), '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  raise exception 'privileged profile columns can only be changed by an admin'
    using errcode = '42501';
end;
$$;

revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;

create trigger profiles_guard_privileged_columns
before update on public.profiles
for each row execute function public.guard_profile_privileged_columns();
