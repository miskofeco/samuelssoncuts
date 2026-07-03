-- Browser Web Push subscriptions for installed PWA/device notifications.
-- Endpoints and encryption keys are scoped to the authenticated owner; the
-- service-role server client performs delivery and stale endpoint cleanup.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  enabled boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_enabled_idx
  on public.push_subscriptions (user_id, enabled);

create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions own read"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "push_subscriptions own insert"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_subscriptions own update"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions own delete"
on public.push_subscriptions for delete
to authenticated
using (user_id = auth.uid());
