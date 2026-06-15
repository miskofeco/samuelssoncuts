import { NextResponse } from "next/server";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  // `as never` casts avoid populating the Functions type, which destabilizes
  // supabase-js relationship inference across the dashboard loaders.
  const { data, error } = await supabase.rpc("calendar_feed" as never, {
    p_token: token,
  } as never);

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
