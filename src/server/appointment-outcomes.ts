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
