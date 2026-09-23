import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/server/auth";
import { adminCalendarWindow, loadAdminCalendar } from "@/server/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { profile } = await getCurrentProfile();
  if (profile?.role !== "admin" || profile.approval_status !== "approved") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  const data = await loadAdminCalendar(adminCalendarWindow(date));
  return NextResponse.json({ ...data, blockedDates: [...data.blockedDates] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
