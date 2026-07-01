-- Add a dedicated 'blocked' value to approval_status so the admin can
-- distinguish "rejected at signup" from "blocked after approval".
-- The auth guards already deny access to any non-'approved' status, so no
-- further policy changes are needed.
alter type public.approval_status add value if not exists 'blocked';
