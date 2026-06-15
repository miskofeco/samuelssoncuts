-- Every registered user must have a unique, populated phone number (and a
-- unique email). We skip SMS verification for now — this only enforces
-- uniqueness + presence at the database level.

-- Unique phone. Partial index so existing rows with no phone (the seeded admin,
-- grandfathered OAuth users) don't collide on NULL; new users are gated to
-- provide one in the app.
create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;

-- Unique email (case-insensitive). Supabase auth.users already enforces email
-- uniqueness; this mirrors it on the profiles table as defense in depth.
create unique index if not exists profiles_email_unique
  on public.profiles (lower(email));

-- RLS on profiles only lets a user read their own row, so an anonymous
-- registrant (or a user completing their profile) cannot SELECT to check
-- whether a phone is already in use. This SECURITY DEFINER function answers that
-- one yes/no question without exposing any other data.
create or replace function public.phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where phone = btrim(p_phone)
  );
$$;

grant execute on function public.phone_taken(text) to anon, authenticated;
