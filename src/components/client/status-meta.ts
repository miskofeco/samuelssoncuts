import type { RequestStatus } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

// Tone is fixed per status; the label is resolved from the active dictionary at
// the call site so it stays localized. Pass the dict from `useT()`/`getDict()`.
const tones: Record<RequestStatus, Tone> = {
  pending: "warning",
  proposed: "info",
  confirmed: "success",
  declined: "danger",
};

export function statusMeta(
  t: Dict,
): Record<RequestStatus, { label: string; tone: Tone }> {
  return {
    pending: { label: t.statuses.pending, tone: tones.pending },
    proposed: { label: t.statuses.proposed, tone: tones.proposed },
    confirmed: { label: t.statuses.confirmed, tone: tones.confirmed },
    declined: { label: t.statuses.declined, tone: tones.declined },
  };
}
