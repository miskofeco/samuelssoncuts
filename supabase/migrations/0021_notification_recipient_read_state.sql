-- Keep notification read-state aligned with the notification center loaders.
-- Some rows are addressed by recipient email rather than user_id; clients must
-- be able to read and mark those same visible rows as read.

drop policy if exists "notifications own or admin read" on public.notifications;
create policy "notifications own or admin read"
on public.notifications for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or recipient = (auth.jwt() ->> 'email')
);

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update"
on public.notifications for update
to authenticated
using (
  user_id = auth.uid()
  or recipient = (auth.jwt() ->> 'email')
)
with check (
  user_id = auth.uid()
  or recipient = (auth.jwt() ->> 'email')
);
