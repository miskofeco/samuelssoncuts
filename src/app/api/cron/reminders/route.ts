// Daily cron — called by Vercel Cron at 08:00 every morning. This is the ONLY
// cron job: the Vercel Hobby plan allows one run per day per job, so the state
// sweep and the email notifications are combined here in one pass.
//
// 1. Outcome sweep: confirmed appointments that ended at least two hours ago
//    without a recorded outcome are marked `completed`; unanswered booking
//    requests and unaccepted proposals whose start has passed are closed.
// 2. Client reminders: every confirmed appointment on the NEXT shop-local day
//    that hasn't been reminded yet gets a reminder email and a reminded_at stamp.
//    (A narrow "23–25h from now" band would only catch appointments starting
//    near the cron minute, so most clients never got a reminder.)
// 3. Barber agenda: digest of today's confirmed appointments.
//
// Vercel Cron schedule: vercel.json → "0 8 * * *"

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBarberEmail } from "@/lib/email";
import { getCronSecret } from "@/lib/env";
import { logEvent, reportError } from "@/lib/observability";
import { dateInShopTimeZone, timeInShopTimeZone } from "@/lib/time-zone";
import { sendEmail } from "@/lib/email";
import { AppointmentReminderEmail } from "@/emails/appointment-reminder";
import { BarberAgendaEmail, type AgendaItem } from "@/emails/barber-agenda";
import {
  autoCompleteFinishedAppointments,
  expireStaleBookingState,
} from "@/server/appointment-outcomes";
import { isAuthorizedCronRequest } from "@/server/cron-auth";
import { enforceRateLimit } from "@/server/rate-limit";
import { createNotification } from "@/server/notifications";
import { reminderWindowFor } from "@/server/reminder-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function termCountLabel(count: number) {
  if (count === 1) return "termín";
  if (count > 1 && count < 5) return "termíny";
  return "termínov";
}

export async function GET(request: NextRequest) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    console.error("[cron/reminders] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret is not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorizedCronRequest(authHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await enforceRateLimit("cron:reminders", {
    identity: "authorized-cron",
    limit: 6,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: 429 });
  }

  // The cron runs with no user session, so RLS on `appointments` (which scopes
  // reads to the row's own client or an admin) would return zero rows for an
  // anon client. Use the service-role admin client to read across all clients.
  const supabase = getSupabaseAdminClient();
  const now = new Date();

  // ---- Outcome / stale-state sweep --------------------------------------
  // Run before the reminders so yesterday's appointments are settled first. A
  // failure here must not block the reminder emails, so it is isolated.
  let completed = 0;
  let declinedRequests = 0;
  let expiredProposals = 0;
  try {
    ({ completed } = await autoCompleteFinishedAppointments(supabase, now));
    ({ declinedRequests, expiredProposals } = await expireStaleBookingState(supabase, now));
  } catch (sweepError) {
    await reportError("cron-complete-appointments", sweepError);
  }

  // ---- Client reminders -------------------------------------------------
  const { startIso: windowStart, endIso: windowEnd } = reminderWindowFor(now);

  // Fetch appointments in the reminder window. We use individual profile/service
  // lookups to avoid TypeScript issues with the generated join types before the
  // migration is applied in production.
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, starts_at, service_id, client_id")
    .eq("status", "confirmed")
    .gte("starts_at", windowStart)
    .lt("starts_at", windowEnd)
    .is("reminded_at", null);

  if (error) {
    await reportError("cron-reminders", error);
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

    const date = dateInShopTimeZone(appt.starts_at);
    const time = timeInShopTimeZone(appt.starts_at);

    await sendEmail({
      to: profile.email,
      subject: `Pripomienka: termín zajtra o ${time}`,
      react: AppointmentReminderEmail({
        clientName: profile.full_name ?? "klient",
        service: service?.name ?? "",
        date,
        time,
      }),
    });

    // Stamp reminded_at so the cron never double-sends even if it runs twice.
    await supabase
      .from("appointments")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", appt.id);

    await createNotification(supabase, {
      user_id: appt.client_id,
      channel: "email",
      recipient: profile.email,
      subject: `Pripomienka: termín zajtra o ${time}`,
      pushUrl: "/client/reservations",
    });

    sent += 1;
  }

  // ---- Barber morning agenda -------------------------------------------
  // Send the barber a digest of today's confirmed appointments. "Today" is in
  // the shop time zone, so query a generous UTC window and filter by shop-date.
  let agendaSent = false;
  try {
    const barberEmail = getBarberEmail();
    if (barberEmail) {
      const todayShop = dateInShopTimeZone(now.toISOString());
      const from = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

      const { data: todaysAppts } = await supabase
        .from("appointments")
        .select("starts_at, service_id, client_id, customer_name")
        .eq("status", "confirmed")
        .gte("starts_at", from)
        .lte("starts_at", to)
        .order("starts_at");

      const forToday = (todaysAppts ?? []).filter(
        (a) => dateInShopTimeZone(a.starts_at) === todayShop,
      );

      const items: AgendaItem[] = [];
      for (const appt of forToday) {
        const [{ data: svc }, { data: prof }] = await Promise.all([
          supabase.from("services").select("name").eq("id", appt.service_id).single(),
          appt.client_id
            ? supabase.from("profiles").select("full_name").eq("id", appt.client_id).single()
            : Promise.resolve({ data: null }),
        ]);
        items.push({
          time: timeInShopTimeZone(appt.starts_at),
          service: svc?.name ?? "",
          customer: prof?.full_name ?? appt.customer_name ?? "Walk-in",
        });
      }

      await sendEmail({
        to: barberEmail,
        subject: `Dnes: ${items.length} ${termCountLabel(items.length)}`,
        react: BarberAgendaEmail({ date: todayShop, items }),
      });
      agendaSent = true;
    }
  } catch (agendaError) {
    // Never let the agenda failure fail the whole cron (reminders already sent).
    await reportError("cron-agenda", agendaError);
  }

  logEvent("cron-reminders", {
    sent,
    agendaSent,
    completed,
    declinedRequests,
    expiredProposals,
  });
  return NextResponse.json({
    ok: true,
    sent,
    agendaSent,
    completed,
    declinedRequests,
    expiredProposals,
  });
}
