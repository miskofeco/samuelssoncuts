import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/server/auth";
import { loadBookingData } from "@/server/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { profile } = await getCurrentProfile();
  if (profile?.role !== "client" || profile.approval_status !== "approved" || !profile.phone) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const data = await loadBookingData({ includeServices: false });
  return NextResponse.json({
    appointments: data.appointments,
    pendingRequests: data.pendingRequests,
    blockedDates: [...data.blockedDates],
    blockedIntervals: data.blockedIntervals,
    businessHours: data.businessHours,
    pricingSettings: data.pricingSettings,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
