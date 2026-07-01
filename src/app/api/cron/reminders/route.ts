// Daily reminder cron — called by Vercel Cron at 08:00 every morning.
// Finds confirmed appointments starting 23–25 hours from now that haven't been
// reminded yet, sends a reminder email to each client, and stamps reminded_at.
//
// Vercel Cron schedule: vercel.json → "0 8 * * *"

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCronSecret } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { AppointmentReminderEmail } from "@/emails/appointment-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  // Fetch appointments in the reminder window. We use individual profile/service
  // lookups to avoid TypeScript issues with the generated join types before the
  // migration is applied in production.
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, starts_at, service_id, client_id")
    .eq("status", "confirmed")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .is("reminded_at" as never, null); // reminded_at added in migration 0012

  if (error) {
    console.error("[cron/reminders] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const appt of appointments ?? []) {
    if (!appt.client_id) continue;

    const [{ data: profile }, { data: service }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", appt.client_id)
        .single(),
      supabase
        .from("services")
        .select("name")
        .eq("id", appt.service_id)
        .single(),
    ]);

    if (!profile?.email) continue;

    const date = appt.starts_at.slice(0, 10);
    const time = appt.starts_at.slice(11, 16);

    await sendEmail({
      to: profile.email,
      subject: `Reminder: your appointment tomorrow at ${time}`,
      react: AppointmentReminderEmail({
        clientName: profile.full_name ?? "there",
        service: service?.name ?? "",
        date,
        time,
      }),
    });

    // Stamp reminded_at so the cron never double-sends even if it runs twice.
    await supabase
      .from("appointments")
      .update({ reminded_at: new Date().toISOString() } as never)
      .eq("id", appt.id);

    await supabase.from("notifications").insert({
      user_id: appt.client_id,
      channel: "email",
      recipient: profile.email,
      subject: `Reminder: your appointment tomorrow at ${time}`,
    });

    sent += 1;
  }

  console.info(`[cron/reminders] sent ${sent} reminder(s)`);
  return NextResponse.json({ ok: true, sent });
}
