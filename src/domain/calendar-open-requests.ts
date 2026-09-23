import type { BookingRequest, Proposal } from "./types";

export type OpenCalendarRequestSlot =
  | { kind: "pending"; request: BookingRequest; date: string; time: string }
  | { kind: "proposed"; request: BookingRequest; proposal: Proposal; date: string; time: string };

/** Open request slots that belong on the admin calendar; never double-show an old requested time. */
export function openCalendarRequestSlots(
  requests: BookingRequest[],
  proposals: Proposal[],
): OpenCalendarRequestSlot[] {
  const sentProposalsById = new Map(
    proposals.filter((proposal) => proposal.status === "sent").map((proposal) => [proposal.id, proposal]),
  );
  const slots: OpenCalendarRequestSlot[] = [];

  for (const request of requests) {
    if (request.status === "pending" && request.requestedDate && request.requestedTime) {
      slots.push({
        kind: "pending",
        request,
        date: request.requestedDate,
        time: request.requestedTime,
      });
    } else if (request.status === "proposed" && request.proposalId) {
      const proposal = sentProposalsById.get(request.proposalId);
      if (proposal?.requestId === request.id) {
        slots.push({ kind: "proposed", request, proposal, date: proposal.date, time: proposal.time });
      }
    }
  }

  return slots;
}
