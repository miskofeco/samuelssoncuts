import type { RequestStatus } from "@/domain/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const requestStatusMeta: Record<
  RequestStatus,
  { label: string; tone: Tone }
> = {
  pending: { label: "Awaiting a proposed time", tone: "warning" },
  proposed: { label: "Time proposed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "success" },
  declined: { label: "Closed", tone: "danger" },
};
