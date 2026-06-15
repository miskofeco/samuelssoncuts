-- Mirror auth.users.email_confirmed_at onto public.profiles so the admin queue
-- (which reads profiles via PostgREST and cannot see auth.users) can hide
-- registrations until the user has verified their email.

alter table public.profiles
  add column if not exists email_confirmed_at timestamptz;

-- Backfill from existing auth users.
update public.profiles p
set email_confirmed_at = u.email_confirmed_at
from auth.users u
where u.id = p.id
  and p.email_confirmed_at is distinct from u.email_confirmed_at;

-- Carry the confirmation timestamp through when the profile is first created
-- (covers the auto-confirm case where email is verified at sign-up time).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.email_confirmed_at
  );
  return new;
end;
$$;

-- Keep the profile in sync the moment the user confirms their email.
create or replace function public.handle_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.profiles
    set email_confirmed_at = new.email_confirmed_at
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
after update on auth.users
for each row execute function public.handle_email_confirmation();
