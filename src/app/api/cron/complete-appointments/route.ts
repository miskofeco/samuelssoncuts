// Appointment outcome sweep — called by Vercel Cron every 30 minutes.
// Marks confirmed appointments as completed once they ended at least two hours
// ago and the barber has not explicitly recorded no-show/cancelled.

import { NextRequest, NextResponse } from "next/server";

import { getCronSecret } from "@/lib/env";
import { logEvent, reportError } from "@/lib/observability";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { autoCompleteFinishedAppointments } from "@/server/appointment-outcomes";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    console.error("[cron/complete-appointments] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret is not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await enforceRateLimit("cron:complete-appointments", {
    identity: "authorized-cron",
    limit: 12,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: 429 });
  }

  const supabase = getSupabaseAdminClient();
  try {
    const { completed } = await autoCompleteFinishedAppointments(supabase);
    logEvent("cron-complete-appointments", { completed });
    return NextResponse.json({ ok: true, completed });
  } catch (error) {
    await reportError("cron-complete-appointments", error);
    return NextResponse.json({ error: "Could not complete appointments" }, { status: 500 });
  }
}
