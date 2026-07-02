import { NextResponse } from "next/server";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

// Rows returned by the calendar_feed SECURITY DEFINER function.
type FeedRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  customer: string;
};

// Live subscription feed — fetched by calendar apps (Google/Apple/…) with no
// session. The secret token in the path authorizes a single barber's confirmed
// appointments via the calendar_feed() SECURITY DEFINER function (RLS would
// otherwise hide everything for an anonymous request). An unknown/old token just
// yields an empty calendar — no error page for the polling client.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limit = await enforceRateLimit("calendar:feed", {
    identity: token,
    limit: 120,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("calendar_feed", {
    p_token: token,
  });

  if (error) {
    await reportError("calendar-feed", error);
  }

  const rows: FeedRow[] = error || !Array.isArray(data) ? [] : (data as FeedRow[]);

  const events: IcsEvent[] = rows.map((row) => ({
    uid: appointmentUid(row.id),
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    summary: row.service_name ? `${row.customer} — ${row.service_name}` : row.customer,
    description: row.service_name,
  }));

  const ics = buildIcs(events, { calName: "Samuelsson Cuts" });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
