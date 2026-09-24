import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { appointmentUid, buildIcs, type IcsEvent } from "@/lib/ics";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/server/rate-limit";
import { DEFAULT_BOOKING_CONTACT } from "@/domain/shop-contact";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getShopBarberId } from "@/server/shop-barber";

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
  if (!z.uuid().safeParse(token).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Per-IP budget stops anonymous floods regardless of the token guessed, and
  // a per-token budget keeps one runaway calendar client in check. The token
  // is hashed so the bearer secret is never written into rate_limits.
  const tokenKey = createHash("sha256").update(token).digest("hex").slice(0, 32);
  const [ipLimit, tokenLimit] = await Promise.all([
    enforceRateLimit("calendar:feed-ip", { limit: 240, windowSeconds: 60 * 60 }),
    enforceRateLimit("calendar:feed", { identity: tokenKey, limit: 120, windowSeconds: 60 * 60 }),
  ]);
  if (!ipLimit.ok || !tokenLimit.ok) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("calendar_feed", {
    p_token: token,
  });

  if (error) {
    await reportError("calendar-feed", error);
    return new NextResponse("Calendar temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }

  if (!Array.isArray(data)) {
    await reportError("calendar-feed", new Error("Unexpected calendar-feed response"));
    return new NextResponse("Calendar temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }

  const rows: FeedRow[] = data as FeedRow[];
  const { data: contact, error: contactError } = await getSupabaseAdminClient()
    .from("booking_contact_settings")
    .select("address")
    .eq("barber_id", await getShopBarberId())
    .maybeSingle();
  if (contactError) {
    await reportError("calendar-feed-contact", contactError);
    return new NextResponse("Calendar temporarily unavailable", { status: 503 });
  }
  const address = contact?.address ?? DEFAULT_BOOKING_CONTACT.address;

  const events: IcsEvent[] = rows.map((row) => ({
    uid: appointmentUid(row.id),
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    summary: row.service_name ? `${row.customer} — ${row.service_name}` : row.customer,
    description: row.service_name,
    location: address,
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
