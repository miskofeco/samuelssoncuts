-- 0043 re-created normalize_phone with the pattern '[[:space:]\\-().]'. With
-- standard_conforming_strings on, that literal keeps both backslashes, so the
-- regex engine reads "\\-(" as a character range from "\" to "(" and raises
-- "invalid regular expression: invalid character range" on every call. The
-- sign-up trigger calls it for every new auth user (email and Google alike),
-- so all registrations failed with "Database error saving new user", and the
-- phone_taken pre-check failed open.
--
-- The hyphen now sits last in the bracket, where it is always literal, and no
-- escapes are needed. Behaviour matches src/domain/phone.ts normalizePhone.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(btrim(coalesce(p_phone, '')), '[[:space:]().-]', '', 'g'),
    '^00',
    '+'
  );
$$;
revoke execute on function public.normalize_phone(text) from public, anon, authenticated;

-- Sign-up trigger. The app rejects a taken phone before calling signUp, but a
-- concurrent registration (or a failed pre-check) could still hit the unique
-- phone index. Aborting would surface only as an opaque "Database error saving
-- new user"; instead the profile is created without a phone and the account is
-- routed to /complete-profile, where a free number is required before approval.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := coalesce(new.email, new.id::text || '@unknown.invalid');
  v_name text := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(v_email, '@', 1)
    ),
    120
  );
  v_phone text := nullif(left(public.normalize_phone(new.raw_user_meta_data ->> 'phone'), 40), '');
begin
  begin
    insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
    values (new.id, v_name, v_email, v_phone, new.email_confirmed_at);
  exception when unique_violation then
    if v_phone is null or not exists (
      select 1 from public.profiles where phone = v_phone
    ) then
      raise;
    end if;
    insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
    values (new.id, v_name, v_email, null, new.email_confirmed_at);
  end;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
