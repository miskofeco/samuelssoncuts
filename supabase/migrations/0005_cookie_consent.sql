-- Cookie-consent audit log. The runtime source of truth for a visitor's choice
-- is the `cookie_consent` cookie (so it works for logged-out visitors too). For
-- signed-in users we ALSO append a dated record here as auditable proof of
-- consent, in line with GDPR/ePrivacy "demonstrate consent" requirements.
--
-- Append-only: each change inserts a new row, so the history of a user's choices
-- is preserved. The latest row per user is the current stored decision.

create table public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  necessary boolean not null default true,
  functional boolean not null default false,
  analytics boolean not null default false,
  marketing boolean not null default false,
  policy_version integer not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index cookie_consents_user_idx
  on public.cookie_consents (user_id, created_at desc);

alter table public.cookie_consents enable row level security;

-- A user may record their own consent (and only their own).
create policy "cookie_consents self insert"
on public.cookie_consents for insert
with check (user_id = auth.uid());

-- A user can read their own consent history; admins can read all (audit).
create policy "cookie_consents self read"
on public.cookie_consents for select
using (user_id = auth.uid() or public.is_admin());
