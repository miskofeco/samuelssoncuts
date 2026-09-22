import type { RequestStatus } from "./types";

export function requiresAdminRequestAction(status: RequestStatus): boolean {
  return status === "pending";
}
