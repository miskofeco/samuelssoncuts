-- Tighten notification inserts. The original 0001 policy allowed ANY
-- authenticated user to insert a notification row with an arbitrary
-- `recipient`/`user_id` (with check (true)). No email is sent from a raw insert,
-- but it let a client fabricate audit rows or spoof another user's feed.
--
-- Every real insert is either the acting user writing their own row
-- (user_id = auth.uid(), e.g. a client notifying the barber of a request) or an
-- admin writing on a client's behalf (approve/propose/confirm/cancel/…). The
-- reminder cron uses the service-role client, which bypasses RLS entirely, so it
-- is unaffected by this policy.

drop policy if exists "notifications authenticated insert" on public.notifications;

create policy "notifications self or admin insert"
on public.notifications for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());
