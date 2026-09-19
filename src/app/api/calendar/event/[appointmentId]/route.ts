import { NextResponse } from "next/server";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/server/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  const { appointmentId } = await params;
  if (!z.uuid().safeParse(appointmentId).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { configured, profile } = await getCurrentProfile();
  if (!configured || !profile) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (profile.approval_status !== "approved") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, service_id, client_id, customer_name, status")
    .eq("id", appointmentId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (error || !appointment) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (profile.role !== "admin" && appointment.client_id !== profile.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [{ data: service }, { data: client }] = await Promise.all([
    supabase.from("services").select("name").eq("id", appointment.service_id).maybeSingle(),
    appointment.client_id
      ? supabase.from("profiles").select("full_name").eq("id", appointment.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const customer = client?.full_name ?? appointment.customer_name ?? "Client";
  const serviceName = service?.name ?? "Appointment";
  const event: IcsEvent = {
    uid: appointmentUid(appointment.id),
    start: new Date(appointment.starts_at),
    end: new Date(appointment.ends_at),
    summary: `Samuelsson Cuts - ${serviceName}`,
    description: `${customer} - ${serviceName}`,
  };
  const ics = buildIcs([event], { calName: "Samuelsson Cuts" });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="samuelsson-appointment.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
