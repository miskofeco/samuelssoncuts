import type { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const AUTO_COMPLETE_GRACE_HOURS = 2;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdminClient>;

export function autoCompleteCutoffIso(now: Date = new Date()) {
  return new Date(now.getTime() - AUTO_COMPLETE_GRACE_HOURS * 60 * 60 * 1000).toISOString();
}

export async function autoCompleteFinishedAppointments(
  supabase: Pick<SupabaseAdmin, "from">,
  now: Date = new Date(),
): Promise<{ completed: number }> {
  const cutoff = autoCompleteCutoffIso(now);
  const { count, error } = await supabase
    .from("appointments")
    .update({ outcome: "completed" }, { count: "exact" })
    .eq("status", "confirmed")
    .is("outcome", null)
    .lte("ends_at", cutoff)
    .select("id");

  if (error) {
    throw error;
  }

  return { completed: count ?? 0 };
}

// Requests the barber never answered and proposals the client never accepted
// are dead once their start time passes. Close them so they leave the request
// queue and the client's active list instead of lingering as "pending" forever.
export async function expireStaleBookingState(
  supabase: Pick<SupabaseAdmin, "from">,
  now: Date = new Date(),
): Promise<{ declinedRequests: number; expiredProposals: number }> {
  const nowIso = now.toISOString();

  const requests = await supabase
    .from("booking_requests")
    .update({ status: "declined" }, { count: "exact" })
    .eq("status", "pending")
    .lt("requested_start", nowIso)
    .select("id");

  if (requests.error) {
    throw requests.error;
  }

  const proposals = await supabase
    .from("appointment_proposals")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "sent")
    .lt("starts_at", nowIso)
    .select("id");

  if (proposals.error) {
    throw proposals.error;
  }

  const expiredProposalIds = (proposals.data ?? []).map((proposal) => proposal.id);
  if (expiredProposalIds.length) {
    const parents = await supabase
      .from("booking_requests")
      .update({ status: "declined", selected_proposal_id: null }, { count: "exact" })
      .eq("status", "proposed")
      .in("selected_proposal_id", expiredProposalIds)
      .select("id");
    if (parents.error) throw parents.error;
  }

  return {
    declinedRequests: requests.count ?? 0,
    expiredProposals: proposals.count ?? 0,
  };
}
