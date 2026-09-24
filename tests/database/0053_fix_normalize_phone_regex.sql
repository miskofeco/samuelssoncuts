-- Run only against a disposable, empty PostgreSQL database with psql -X -v
-- ON_ERROR_STOP=1 -f tests/database/0053_fix_normalize_phone_regex.sql.
-- The fixture is intentionally small and the entire test rolls back.
begin;

create role anon;
create role authenticated;
create role service_role;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  email_confirmed_at timestamptz
);
create unique index profiles_phone_unique on public.profiles (phone) where phone is not null;
create unique index profiles_email_unique on public.profiles (lower(email));

-- The broken 0043 definition and the pre-0053 trigger, as deployed.
create function public.normalize_phone(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(btrim(coalesce(p_phone, '')), '[[:space:]\\-().]', '', 'g'),
    '^00', '+');
$$;
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, email_confirmed_at)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'x'), new.email,
    nullif(left(public.normalize_phone(new.raw_user_meta_data ->> 'phone'), 40), ''),
    new.email_confirmed_at);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
create function public.phone_taken(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where phone is not null
      and public.normalize_phone(phone) = public.normalize_phone(p_phone)
  );
$$;

-- Reproduce the production failure before applying the fix.
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into auth.users (email, raw_user_meta_data)
    values ('before-fix@example.test', '{"full_name":"Before Fix","phone":"+421900000001"}');
  exception when invalid_regular_expression then v_failed := true;
  end;
  if not v_failed then raise exception 'fixture no longer reproduces the 0043 regex failure'; end if;
end;
$$;

\ir ../../supabase/migrations/0053_fix_normalize_phone_regex.sql

do $$
declare
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_failed boolean;
begin
  -- Canonical form matches src/domain/phone.ts normalizePhone.
  if public.normalize_phone(' +421 900 123 456 ') <> '+421900123456'
     or public.normalize_phone('0900-123-456') <> '0900123456'
     or public.normalize_phone('(0)900.123.456') <> '0900123456'
     or public.normalize_phone('00421900123456') <> '+421900123456'
     or public.normalize_phone(null) <> '' then
    raise exception 'normalize_phone does not match the app canonical form';
  end if;

  -- Email + password sign-up: profile with the canonical phone.
  insert into auth.users (email, raw_user_meta_data)
  values ('email-signup@example.test', '{"full_name":"  Email Signup ","phone":"+421 914 234-432"}')
  returning id into v_id;
  select * into v_profile from public.profiles where id = v_id;
  if v_profile.phone is distinct from '+421914234432' or v_profile.full_name <> 'Email Signup' then
    raise exception 'email sign-up profile is wrong: %', row_to_json(v_profile);
  end if;

  -- Duplicate check used by the register and complete-profile actions.
  if not public.phone_taken('00421 914 234 432') or public.phone_taken('+421999999999') then
    raise exception 'phone_taken is wrong';
  end if;

  -- Google sign-up: no phone, name from provider metadata.
  insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
  values ('google-signup@example.test', '{"name":"Google Person"}', now())
  returning id into v_id;
  select * into v_profile from public.profiles where id = v_id;
  if v_profile.phone is not null or v_profile.full_name <> 'Google Person'
     or v_profile.email_confirmed_at is null then
    raise exception 'OAuth sign-up profile is wrong: %', row_to_json(v_profile);
  end if;

  -- A phone taken concurrently does not abort sign-up; the phone is left empty
  -- so /complete-profile asks for another one.
  insert into auth.users (email, raw_user_meta_data)
  values ('race@example.test', '{"full_name":"Race","phone":"+421914234432"}')
  returning id into v_id;
  select * into v_profile from public.profiles where id = v_id;
  if v_profile.id is null or v_profile.phone is not null then
    raise exception 'duplicate phone should create a phone-less profile';
  end if;

  -- Any other uniqueness conflict still fails loudly.
  v_failed := false;
  begin
    insert into auth.users (email, raw_user_meta_data)
    values ('EMAIL-SIGNUP@example.test', '{"full_name":"Dup"}');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'duplicate profile email was accepted'; end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.normalize_phone(text)', 'execute')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') then
    raise exception 'internal helper is callable by a client role';
  end if;
end;
$$;

rollback;
