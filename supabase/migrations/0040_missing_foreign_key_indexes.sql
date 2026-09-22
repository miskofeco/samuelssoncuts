-- These five foreign-key columns have no covering index. Tables are currently
-- small, so ordinary transactional index creation has a short lock duration.
create index if not exists appointment_proposals_barber_id_idx
  on public.appointment_proposals (barber_id);

create index if not exists appointments_proposal_id_idx
  on public.appointments (proposal_id);

create index if not exists appointments_service_id_idx
  on public.appointments (service_id);

create index if not exists booking_requests_selected_proposal_id_idx
  on public.booking_requests (selected_proposal_id);

create index if not exists booking_requests_service_id_idx
  on public.booking_requests (service_id);
