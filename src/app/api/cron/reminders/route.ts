// Daily cron — called by Vercel Cron at 08:00 every morning. This is the ONLY
// cron job: the Vercel Hobby plan allows one run per day per job, so the state
// sweep and the email notifications are combined here in one pass.
//
// 1. Outcome sweep: confirmed appointments that ended at least two hours ago
//    without a recorded outcome are marked `completed`; unanswered booking
//    requests and unaccepted proposals whose start has passed are closed.
// 2. Client reminders: every confirmed appointment on the NEXT shop-local day
//    that hasn't been reminded yet gets a reminder email and a reminded_at stamp.
//    The stamp is CLAIMED first (atomic update … where reminded_at is null), so
//    a retry or an overlapping run can never double-send; a failed send releases
//    the claim so the next run retries it.
// 3. Barber agenda: digest of today's confirmed appointments.
// 4. Housekeeping: expired rate-limit rows are pruned.
//
// Vercel Cron schedule: vercel.json → "0 8 * * *"

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
import { clientReminderPush } from "@/domain/push-copy";
import { createNotifications, type NotificationInput } from "@/server/notifications";
import { reminderWindowFor } from "@/server/reminder-window";
import { getShopBarberEmail, getShopBarberId } from "@/server/shop-barber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The default function budget is too short for a day's worth of sequential
// email sends; give the daily job room and keep the work batched.
export const maxDuration = 60;

const SEND_CONCURRENCY = 5;

function termCountLabel(count: number) {
  if (count === 1) return "termín";
  if (count > 1 && count < 5) return "termíny";
  return "termínov";
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type Supabase = ReturnType<typeof getSupabaseAdminClient>;

async function lookupNames(supabase: Supabase, clientIds: string[], serviceIds: string[]) {
  const [profilesResult, servicesResult] = await Promise.all([
    clientIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (servicesResult.error) throw servicesResult.error;
  return {
    profiles: new Map((profilesResult.data ?? []).map((row) => [row.id, row])),
    services: new Map((servicesResult.data ?? []).map((row) => [row.id, row.name])),
  };
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

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, starts_at, service_id, client_id")
    .eq("status", "confirmed")
    .gte("starts_at", windowStart)
    .lt("starts_at", windowEnd)
    .is("reminded_at", null);

  if (error) {
    await reportError("cron-reminders", error);
    return NextResponse.json({ error: "Could not load appointments" }, { status: 500 });
  }

  const candidates = (appointments ?? []).filter((appt) => appt.client_id);
  let sent = 0;
  let failed = 0;
  const notifications: NotificationInput[] = [];

  if (candidates.length > 0) {
    const { profiles, services } = await lookupNames(
      supabase,
      [...new Set(candidates.map((a) => a.client_id as string))],
      [...new Set(candidates.map((a) => a.service_id))],
    );

    await mapLimited(candidates, SEND_CONCURRENCY, async (appt) => {
      const profile = profiles.get(appt.client_id as string);
      if (!profile?.email) return;

      // Claim first: only the run that flips reminded_at from null sends.
      const { data: claimed } = await supabase
        .from("appointments")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", appt.id)
        .is("reminded_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) return;

      const date = dateInShopTimeZone(appt.starts_at);
      const time = timeInShopTimeZone(appt.starts_at);
      const subject = `Pripomienka: termín zajtra o ${time}`;

      const delivered = await sendEmail({
        to: profile.email,
        subject,
        react: AppointmentReminderEmail({
          clientName: profile.full_name ?? "klient",
          service: services.get(appt.service_id) ?? "",
          date,
          time,
        }),
      });

      if (!delivered) {
        // Release the claim so tomorrow's run (or a manual re-run) retries.
        failed += 1;
        await supabase.from("appointments").update({ reminded_at: null }).eq("id", appt.id);
        return;
      }

      sent += 1;
      notifications.push({
        user_id: appt.client_id,
        channel: "email",
        recipient: profile.email,
        subject,
        push: clientReminderPush({ service: services.get(appt.service_id), date, time }),
        pushUrl: "/client/reservations",
      });
    });

    try {
      await createNotifications(supabase, notifications);
    } catch (notifyError) {
      await reportError("cron-reminder-notifications", notifyError);
    }
  }

  // ---- Barber morning agenda -------------------------------------------
  // Send the barber a digest of today's confirmed appointments. "Today" is in
  // the shop time zone, so query a generous UTC window and filter by shop-date.
  let agendaSent = false;
  try {
    const barberEmail = await getShopBarberEmail();
    if (barberEmail) {
      const todayShop = dateInShopTimeZone(now.toISOString());
      const from = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

      const { data: todaysAppts, error: agendaError } = await supabase
        .from("appointments")
        .select("starts_at, service_id, client_id, customer_name")
        .eq("barber_id", await getShopBarberId())
        .eq("status", "confirmed")
        .gte("starts_at", from)
        .lte("starts_at", to)
        .order("starts_at");
      if (agendaError) throw agendaError;

      const forToday = (todaysAppts ?? []).filter(
        (a) => dateInShopTimeZone(a.starts_at) === todayShop,
      );
      const { profiles, services } = await lookupNames(
        supabase,
        [...new Set(forToday.flatMap((a) => (a.client_id ? [a.client_id] : [])))],
        [...new Set(forToday.map((a) => a.service_id))],
      );

      const items: AgendaItem[] = forToday.map((appt) => ({
        time: timeInShopTimeZone(appt.starts_at),
        service: services.get(appt.service_id) ?? "",
        customer:
          (appt.client_id ? profiles.get(appt.client_id)?.full_name : null) ??
          appt.customer_name ??
          "Walk-in",
      }));

      agendaSent = await sendEmail({
        to: barberEmail,
        subject: `Dnes: ${items.length} ${termCountLabel(items.length)}`,
        react: BarberAgendaEmail({ date: todayShop, items }),
      });
    }
  } catch (agendaError) {
    // Never let the agenda failure fail the whole cron (reminders already sent).
    await reportError("cron-agenda", agendaError);
  }

  // ---- Housekeeping -------------------------------------------------------
  // rate_limits rows are never read again once their window closed.
  let prunedRateLimits = 0;
  try {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("reset_at", cutoff);
    prunedRateLimits = count ?? 0;
  } catch (pruneError) {
    await reportError("cron-prune-rate-limits", pruneError);
  }

  const summary = {
    sent,
    failed,
    agendaSent,
    completed,
    declinedRequests,
    expiredProposals,
    prunedRateLimits,
  };
  logEvent("cron-reminders", summary);
  return NextResponse.json({ ok: true, ...summary });
}
