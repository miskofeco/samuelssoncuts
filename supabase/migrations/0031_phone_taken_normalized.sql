-- The app now stores phone numbers in a canonical form (digits with an optional
-- leading "+", separators removed, "00" folded to "+"; see src/domain/phone.ts).
-- Rows written before this change may still contain spaces or dashes, so the
-- duplicate check compares both sides in canonical form. Existing rows are left
-- untouched: rewriting them could collide on the unique index.

create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(btrim(coalesce(p_phone, '')), '[[:space:]\-().]', '', 'g'),
    '^00',
    '+'
  );
$$;

create or replace function public.phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where phone is not null
      and public.normalize_phone(phone) = public.normalize_phone(p_phone)
  );
$$;

grant execute on function public.phone_taken(text) to anon, authenticated;
