import { type NextRequest, NextResponse } from "next/server";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { getCurrentProfile } from "@/server/auth";
import { loadExportAppointments } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

// One-off .ics download of confirmed appointments for a range starting today.
// Admins export the whole schedule; clients export only their own appointments.
// Manual auth guard — API routes return responses, they don't redirect.
export async function GET(request: NextRequest) {
  const { profile } = await getCurrentProfile();
  if (!profile) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // Clients are scoped to their own appointments; admins see everything.
  const clientId = profile.role === "admin" ? undefined : profile.id;

  const range = request.nextUrl.searchParams.get("range") === "month" ? "month" : "week";

  // Today at local midnight → +7 days (week) or +1 month (month).
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  if (range === "month") {
    to.setMonth(to.getMonth() + 1);
  } else {
    to.setDate(to.getDate() + 7);
  }

  const appointments = await loadExportAppointments(
    from.toISOString(),
    to.toISOString(),
    clientId,
  );

  const events: IcsEvent[] = appointments.map((a) => ({
    uid: appointmentUid(a.id),
    start: a.start,
    end: a.end,
    summary: a.serviceName ? `${a.customer} — ${a.serviceName}` : a.customer,
    description: a.serviceName,
  }));

  const ics = buildIcs(events, { calName: "Samuelsson Cuts" });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="samuelsson-${range}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
