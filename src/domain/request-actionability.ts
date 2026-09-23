import type { RequestStatus } from "./types";

export function requiresAdminRequestAction(status: RequestStatus): boolean {
  return status === "pending";
}

/** An admin can revise a new request or a proposal still awaiting the client. */
export function canAdminSuggestAnotherTime(status: RequestStatus): boolean {
  return status === "pending" || status === "proposed";
}
