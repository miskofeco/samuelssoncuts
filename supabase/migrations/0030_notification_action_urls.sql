-- Persist the destination associated with an in-app notification. This keeps
-- presentation logic independent from localized subject/body text.
alter table public.notifications
  add column if not exists action_url text
  check (action_url is null or action_url ~ '^/[A-Za-z0-9/_?&=.%+-]*$');

