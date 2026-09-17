import type { ApprovalStatus } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";

export const clientStatusTone: Record<ApprovalStatus, "success" | "warning" | "danger"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  blocked: "danger",
};

export function clientStatusLabel(t: Dict, status: ApprovalStatus) {
  switch (status) {
    case "approved": return t.statuses.approved;
    case "pending": return t.statuses.approvalPending;
    case "rejected": return t.statuses.rejected;
    case "blocked": return t.statuses.blocked;
  }
}
