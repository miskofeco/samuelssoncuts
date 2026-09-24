import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type Supabase = SupabaseClient<Database>;
type Appointment = Pick<Database["public"]["Tables"]["appointments"]["Row"],
  "id" | "starts_at" | "client_id" | "service_id"> & { client_id: string };

// The claim is an atomic compare-and-set, including fields that may have
// changed since the due-candidate read. A cancelled/rescheduled booking cannot
// be claimed from a stale snapshot.
export async function claimReminder(
  supabase: Supabase,
  appointment: Appointment,
  claimAtIso: string,
  windowEndIso: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .update({ reminded_at: claimAtIso })
    .eq("id", appointment.id)
    .eq("status", "confirmed")
    .eq("starts_at", appointment.starts_at)
    .eq("client_id", appointment.client_id)
    .eq("service_id", appointment.service_id)
    .gt("starts_at", claimAtIso)
    .lt("starts_at", windowEndIso)
    .is("reminded_at", null)
    .select("id")
    .maybeSingle();

  return { claimed: Boolean(data), error };
}

// This second read closes the gap between the candidate query and the send.
// A cancellation after this read can still race the external email provider.
export async function reminderStillCurrent(
  supabase: Supabase,
  appointment: Appointment,
  claimAtIso: string,
  nowIso: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointment.id)
    .eq("status", "confirmed")
    .eq("starts_at", appointment.starts_at)
    .eq("client_id", appointment.client_id)
    .eq("service_id", appointment.service_id)
    .eq("reminded_at", claimAtIso)
    .gt("starts_at", nowIso)
    .maybeSingle();

  return { current: Boolean(data), error };
}

export async function releaseReminderClaim(supabase: Supabase, appointmentId: string, claimAtIso: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ reminded_at: null })
    .eq("id", appointmentId)
    .eq("reminded_at", claimAtIso)
    .select("id")
    .maybeSingle();
  return { error };
}
