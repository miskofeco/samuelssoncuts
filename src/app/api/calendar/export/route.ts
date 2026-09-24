import { type NextRequest, NextResponse } from "next/server";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { addDaysToDate, dateInShopTimeZone, shopDayRangeUtc } from "@/lib/time-zone";
import { getCurrentProfile } from "@/server/auth";
import { loadBookingContactSettings, loadExportAppointments } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

// One-off .ics download of confirmed appointments for a range starting today.
// Admins export the whole schedule; clients export only their own appointments.
// Manual auth guard — API routes return responses, they don't redirect.
export async function GET(request: NextRequest) {
  const { profile } = await getCurrentProfile();
  if (!profile) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (profile.approval_status !== "approved") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Clients are scoped to their own appointments; admins see everything.
  const clientId = profile.role === "admin" ? undefined : profile.id;

  const range = request.nextUrl.searchParams.get("range") === "month" ? "month" : "week";

  // Today at SHOP-local midnight (the server runs in UTC) → +7 or +31 days.
  const today = dateInShopTimeZone(new Date().toISOString());
  const { startIso } = shopDayRangeUtc(today);
  const { startIso: endIso } = shopDayRangeUtc(addDaysToDate(today, range === "month" ? 31 : 7));

  const [appointments, contact] = await Promise.all([
    loadExportAppointments(startIso, endIso, clientId),
    loadBookingContactSettings(),
  ]);

  const events: IcsEvent[] = appointments.map((a) => ({
    uid: appointmentUid(a.id),
    start: a.start,
    end: a.end,
    summary: a.serviceName ? `${a.customer} — ${a.serviceName}` : a.customer,
    description: a.serviceName,
    location: contact.address,
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
