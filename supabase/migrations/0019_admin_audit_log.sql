-- Admin audit log. Records privileged actions (client approvals, blocks,
-- deletions, appointment reschedules/cancellations, …) for accountability and
-- incident review. Append-only: no update/delete policy is granted, so rows
-- cannot be altered or removed through the API.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  -- Free-form target identity (usually a client or appointment id) plus a small
  -- JSON detail blob. No PII beyond what the admin already sees is stored.
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only admins may read the audit trail.
create policy "admin_audit_log admin read"
on public.admin_audit_log for select
to authenticated
using (public.is_admin());

-- Writes go exclusively through the SECURITY DEFINER function below, which
-- re-checks admin status and stamps actor_id server-side. No direct INSERT
-- policy is granted, so a client cannot forge audit rows even if they craft a
-- PostgREST request.
create or replace function public.record_admin_action(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.record_admin_action(text, text, text, jsonb) to authenticated;
