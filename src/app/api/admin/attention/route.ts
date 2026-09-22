import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/server/auth";
import { loadAttentionCounts } from "@/server/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { profile } = await getCurrentProfile();
  if (profile?.role !== "admin" || profile.approval_status !== "approved") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json(await loadAttentionCounts(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
