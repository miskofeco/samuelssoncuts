"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/env";
import { getBarberEmail, sendEmail } from "@/lib/email";
import { reportError } from "@/lib/observability";
import { AccountApprovedEmail } from "@/emails/account-approved";
import { AccountBlockedEmail } from "@/emails/account-blocked";
import { AccountRejectedEmail } from "@/emails/account-rejected";
import { AppointmentCancelledEmail } from "@/emails/appointment-cancelled";
import { AppointmentConfirmedEmail } from "@/emails/appointment-confirmed";
import { AppointmentProposedEmail } from "@/emails/appointment-proposed";
import { AppointmentRescheduledEmail } from "@/emails/appointment-rescheduled";
import { BookingReceivedEmail } from "@/emails/booking-received";
import { BookingRequestEmail } from "@/emails/booking-request";
import { ClientRespondedEmail } from "@/emails/client-responded";
import { SlotTakenEmail } from "@/emails/slot-taken";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { zonedDateTimeToUtcIso, timeInShopTimeZone, dateInShopTimeZone } from "@/lib/time-zone";
import { CONSENT_VERSION } from "@/lib/consent/config";
import {
  clientSlotsForService,
  isPreferredClientStart,
  isStartInClientBookingWindow,
  isStartInFuture,
  minutesOf,
  priceForSlot,
} from "@/domain/schedule";
import {
  hasBlockedTimeOverlap,
  hasConfirmedAppointmentOverlap,
  isSlotInsideConfiguredBusinessHours,
} from "@/server/booking-guards";
import { dashboardPathFor, getCurrentProfile, requireAdmin, requireApprovedClient, requireProfile } from "@/server/auth";
import { recordAdminAction } from "@/server/audit";
import { enforceRateLimit } from "@/server/rate-limit";
import type { ActionResult } from "@/domain/types";
import { getDict } from "@/i18n/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const oauthProviderSchema = z.enum(["google", "apple"]);

const consentSchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  version: z.number().int(),
  timestamp: z.string().max(40).optional(),
});

const registerSchema = signInSchema.extend({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(4).max(40),
});

// New flow: the client picks an exact date + time for the chosen service.
const createRequestSchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(1000).optional(),
});

const proposeSchema = z.object({
  requestId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(1000).optional(),
});

const adminBookingSchema = z
  .object({
    clientId: z.uuid().optional(),
    customerName: z.string().trim().min(1).max(120).optional(),
    serviceId: z.uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    note: z.string().max(1000).optional(),
  })
  // Exactly one of clientId / customerName: an existing client or a walk-in.
  // The sentinel message is mapped to a localized string in the action.
  .refine((value) => Boolean(value.clientId) !== Boolean(value.customerName), {
    message: "client-or-walkin",
  });

const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(1000).optional(),
});

const cancelAppointmentSchema = z.object({
  appointmentId: z.uuid(),
  note: z.string().max(1000).optional(),
});

const profileSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(4).max(40),
});

const serviceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(600),
  priceCents: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().max(500).optional(),
});

const blockDateSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
  // Optional time slice on the start date (e.g. a lunch break or a 2–4pm gap).
  // When both are present, only that window on `start` is blocked, not full days.
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const businessHoursSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    opensAt: z.string().regex(/^\d{2}:\d{2}$/),
    closesAt: z.string().regex(/^\d{2}:\d{2}$/),
    closed: z.boolean(),
  }),
)
  .length(7)
  .refine((days) => new Set(days.map((day) => day.weekday)).size === days.length, {
    message: "duplicate-weekdays",
  })
  .refine((days) => days.every((day) => day.closed || minutesOf(day.closesAt) > minutesOf(day.opensAt)), {
    message: "invalid-hours",
  });

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Whether a phone number is already used by some profile. Goes through the
// `phone_taken` SECURITY DEFINER function because RLS forbids reading other
// users' profile rows (so a plain select would always return empty for anon).
// The unique index on profiles.phone is the real backstop; this just lets us
// show a friendly message before attempting the write.
async function isPhoneTaken(supabase: SupabaseClient, phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("phone_taken", {
    p_phone: phone.trim(),
  });
  if (error) return false; // fail open — the DB unique index still protects us
  return data === true;
}

// Postgres unique-violation surfaced through the phone index (race backstop).
function isDuplicatePhoneError(message: string | undefined): boolean {
  return Boolean(message && message.includes("profiles_phone_unique"));
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function startsAt(date: string, time: string) {
  return zonedDateTimeToUtcIso(date, time);
}

// "HH:MM" in the shop time zone from an ISO timestamp.
function timeFromIso(iso: string) {
  return timeInShopTimeZone(iso);
}

export async function signInAction(formData: FormData) {
  const t = await getDict();
  const input = signInSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!input.success) {
    redirect(`/login?error=${encodeURIComponent(t.feedback.checkEmailPassword)}`);
  }

  const limit = await enforceRateLimit("auth:sign-in", {
    identity: input.data.email,
    limit: 8,
    windowSeconds: 15 * 60,
  });
  if (!limit.ok) {
    redirect(`/login?error=${encodeURIComponent(limit.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function requestPasswordResetAction(formData: FormData) {
  const t = await getDict();
  const email = signInSchema.shape.email.safeParse(formString(formData, "email"));

  // Always show the same neutral message (don't leak which emails are registered).
  const sentUrl = `/reset-password?message=${encodeURIComponent(t.auth.resetSent)}`;
  if (!email.success) {
    redirect(sentUrl);
  }

  const limit = await enforceRateLimit("auth:reset-request", {
    identity: email.data,
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!limit.ok) {
    redirect(`/reset-password?error=${encodeURIComponent(limit.error)}`);
  }

  const supabase = await createClient();
  // The recovery link lands on /auth/callback, which exchanges the code and
  // forwards recovery sessions to /auth/update-password.
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?type=recovery`,
  });

  redirect(sentUrl);
}

export async function updatePasswordAction(formData: FormData) {
  const t = await getDict();
  const password = signInSchema.shape.password.safeParse(formString(formData, "password"));

  if (!password.success) {
    redirect(`/auth/update-password?error=${encodeURIComponent(t.feedback.checkEmailPassword)}`);
  }

  // The recovery session was established by /auth/callback; updateUser applies to it.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });

  if (error) {
    redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent(t.auth.updated)}`);
}

export async function signInWithOAuthAction(formData: FormData) {
  const t = await getDict();
  const provider = oauthProviderSchema.safeParse(formString(formData, "provider"));

  if (!provider.success) {
    redirect(`/login?error=${encodeURIComponent(t.feedback.unsupportedProvider)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? t.feedback.couldNotStartSignIn)}`);
  }

  // Hand off to the provider's consent screen.
  redirect(data.url);
}

export async function registerAction(formData: FormData) {
  const t = await getDict();
  const input = registerSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
  });

  if (!input.success) {
    redirect(`/register?error=${encodeURIComponent(t.feedback.fillAllFields)}`);
  }

  const registrationLimit = await enforceRateLimit("auth:register", {
    identity: input.data.email,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!registrationLimit.ok) {
    redirect(`/register?error=${encodeURIComponent(registrationLimit.error)}`);
  }

  const phone = input.data.phone.trim();
  const supabase = await createClient();

  // Reject a phone number that's already in use before creating the auth user.
  if (await isPhoneTaken(supabase, phone)) {
    redirect(`/register?error=${encodeURIComponent(t.feedback.phoneTaken)}`);
  }

  const { error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: input.data.fullName,
        phone,
      },
    },
  });

  if (error) {
    // Backstop for a race between the check above and the trigger insert.
    const message = isDuplicatePhoneError(error.message)
      ? t.feedback.phoneTaken
      : error.message;
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }

  redirect(`/login?message=${encodeURIComponent(t.feedback.registrationCreated)}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Persist a signed-in user's cookie-consent choice as an auditable, append-only
// record (proof of consent). The runtime source of truth is the client-side
// `cookie_consent` cookie; this only mirrors the decision to the DB and is a
// no-op for logged-out visitors. It never blocks the UI — failures are silent.
export async function recordConsentAction(input: unknown): Promise<ActionResult> {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid consent payload." };
  }

  // Logged-out visitors are fine — their choice lives only in the cookie.
  const { configured, profile } = await getCurrentProfile();
  if (!configured || !profile) {
    return { ok: true };
  }

  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

  const supabase = await createClient();
  const { error } = await supabase.from("cookie_consents").insert({
    user_id: profile.id,
    necessary: true,
    functional: parsed.data.functional,
    analytics: parsed.data.analytics,
    marketing: parsed.data.marketing,
    policy_version: parsed.data.version || CONSENT_VERSION,
    user_agent: userAgent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function createBookingRequestAction(input: unknown): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const parsed = createRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickServiceAndDays };
  }

  const limit = await enforceRateLimit("booking:create-request", {
    identity: profile.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const supabase = await createClient();

  // Load the service (duration + base price). Price is computed server-side and
  // never trusted from the client.
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, duration_minutes, price_cents")
    .eq("id", parsed.data.serviceId)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const startMin = minutesOf(parsed.data.time);
  const start = startsAt(parsed.data.date, parsed.data.time);
  const end = addMinutes(start, service.duration_minutes);

  // Must be in the future, inside the client booking window, and fit inside working hours.
  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  if (!isStartInClientBookingWindow(start)) {
    return { ok: false, error: t.feedback.chooseWithinTwoWeeks };
  }
  if (
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (await hasBlockedTimeOverlap(supabase, { start, end })) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }
  if (await hasConfirmedAppointmentOverlap(supabase, { start, end })) {
    return { ok: false, error: t.feedback.slotNoLongerFree };
  }

  // The slot must not overlap a CONFIRMED appointment that day (pending requests
  // from other clients are allowed to coexist).
  const dayStart = startsAt(parsed.data.date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const { data: dayAppts } = await supabase.rpc("confirmed_appointment_slots");

  // Gap pricing: base only if the slot opens the day or extends the gapless
  // block anchored at opening; otherwise +10%.
  const confirmedForDay = (dayAppts ?? [])
    .filter((a) => a.starts_at >= dayStart && a.starts_at < dayEnd)
    .map((a) => ({
      date: parsed.data.date,
      time: timeFromIso(a.starts_at),
      durationMinutes: Math.round(
        (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000,
      ),
    }));
  if (!clientSlotsForService(parsed.data.date, service.duration_minutes, confirmedForDay).includes(parsed.data.time)) {
    return { ok: false, error: t.feedback.pickGeneratedSlot };
  }
  const preferred = isPreferredClientStart(
    parsed.data.date,
    startMin,
    service.duration_minutes,
    confirmedForDay,
  );
  const basePrice = Math.round(service.price_cents / 100);
  const priceCents = priceForSlot(basePrice, preferred) * 100;

  const { error: requestError } = await supabase.from("booking_requests").insert({
    client_id: profile.id,
    service_id: parsed.data.serviceId,
    note: parsed.data.note ?? null,
    status: "pending",
    requested_start: start,
    requested_end: end,
    price_cents: priceCents,
    surcharge: !preferred,
  });

  if (requestError) {
    return { ok: false, error: requestError.message };
  }

  const barberEmail = getBarberEmail();
  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: barberEmail,
    subject: `${profile.full_name} requested ${parsed.data.date} at ${parsed.data.time}`,
  });
  await sendEmail({
    to: barberEmail,
    subject: `${profile.full_name} requested ${parsed.data.date} at ${parsed.data.time}`,
    react: BookingRequestEmail({
      clientName: profile.full_name,
      service: service.name,
      date: parsed.data.date,
      time: parsed.data.time,
      note: parsed.data.note,
    }),
  });

  // Acknowledge to the client too (they used to hear nothing until confirmation).
  if (profile.email) {
    const clientSubject = "We received your booking request";
    await supabase.from("notifications").insert({
      user_id: profile.id,
      channel: "email",
      recipient: profile.email,
      subject: clientSubject,
      body: `Your request for ${service.name} on ${parsed.data.date} at ${parsed.data.time} was received. The barber will confirm shortly.`,
    });
    await sendEmail({
      to: profile.email,
      subject: clientSubject,
      react: BookingReceivedEmail({
        clientName: profile.full_name,
        service: service.name,
        date: parsed.data.date,
        time: parsed.data.time,
      }),
    });
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.bookingRequestPlaced };
}

export async function createRequestFromClientAction(
  serviceId: string,
  date: string,
  time: string,
  note: string,
): Promise<ActionResult> {
  return createBookingRequestAction({ serviceId, date, time, note });
}

export async function approveClientAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();

  // Don't approve anyone who hasn't verified their email yet.
  const { data: candidate } = await supabase
    .from("profiles")
    .select("email_confirmed_at")
    .eq("id", clientId)
    .single();

  if (!candidate?.email_confirmed_at) {
    return { ok: false, error: t.feedback.emailNotConfirmed };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", clientId)
    .select("id, email, full_name")
    .single();

  if (error || !profile) {
    return { ok: false, error: error?.message ?? t.feedback.couldNotApprove };
  }

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Your Samuelsson Cuts account was approved",
    body: `Hi ${profile.full_name}, your account is approved. You can now request appointments.`,
  });
  await sendEmail({
    to: profile.email,
    subject: "Your Samuelsson Cuts account was approved",
    react: AccountApprovedEmail({ clientName: profile.full_name }),
  });

  await recordAdminAction("client.approve", { targetType: "profile", targetId: clientId });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.clientApproved };
}

export async function rejectClientAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", clientId)
    .select("id, email, full_name")
    .single();

  if (error || !profile) {
    return { ok: false, error: error?.message ?? t.feedback.couldNotUpdateClient };
  }

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Update on your Samuelsson Cuts account",
    body: `Hi ${profile.full_name}, we are unable to approve your account at this time.`,
  });
  await sendEmail({
    to: profile.email,
    subject: "Update on your Samuelsson Cuts account",
    react: AccountRejectedEmail({ clientName: profile.full_name }),
  });

  await recordAdminAction("client.reject", { targetType: "profile", targetId: clientId });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.registrationRejected };
}

// Block an approved client: set status to 'blocked', cancel all their pending /
// proposed requests and upcoming confirmed appointments, notify them by email.
export async function blockClientAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ approval_status: "blocked" })
    .eq("id", clientId)
    .select("id, email, full_name")
    .single();

  if (profileError || !profile) {
    return { ok: false, error: profileError?.message ?? t.feedback.couldNotUpdateClient };
  }

  // Cancel all pending/proposed booking requests.
  await supabase
    .from("booking_requests")
    .update({ status: "cancelled" })
    .eq("client_id", clientId)
    .in("status", ["pending", "proposed"]);

  // Cancel future confirmed appointments — just delete them (same as the admin cancel flow).
  const now = new Date().toISOString();
  await supabase
    .from("appointments")
    .delete()
    .eq("client_id", clientId)
    .gt("starts_at", now);

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Your Samuelsson Cuts account access has been removed",
  });
  await sendEmail({
    to: profile.email,
    subject: "Your Samuelsson Cuts account access has been removed",
    react: AccountBlockedEmail({ clientName: profile.full_name }),
  });

  await recordAdminAction("client.block", { targetType: "profile", targetId: clientId });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.clientBlocked };
}

// Restore a blocked client back to approved.
export async function unblockClientAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", clientId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("client.unblock", { targetType: "profile", targetId: clientId });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.clientUnblocked };
}

// Permanently delete a client account and all associated data.
// Appointments and requests are cascade-deleted by the DB foreign keys.
// The auth.users row is deleted via the Supabase admin API which also removes
// the profile row (cascade on profiles.id → auth.users.id).
export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();

  // Destructive + service-role powered — cap how fast it can be invoked.
  const limit = await enforceRateLimit("admin:delete-client", {
    identity: admin.id,
    limit: 20,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  try {
    const adminSupabase = getSupabaseAdminClient();
    const { data: requests, error: requestListError } = await adminSupabase
      .from("booking_requests")
      .select("id")
      .eq("client_id", clientId);

    if (requestListError) {
      await reportError("delete-client", requestListError, { clientId, phase: "list-requests" });
      return { ok: false, error: requestListError.message };
    }

    const requestIds = (requests ?? []).map((request) => request.id);

    const { error: appointmentClientDeleteError } = await adminSupabase
      .from("appointments")
      .delete()
      .eq("client_id", clientId);

    if (appointmentClientDeleteError) {
      await reportError("delete-client", appointmentClientDeleteError, {
        clientId,
        phase: "delete-client-appointments",
      });
      return { ok: false, error: appointmentClientDeleteError.message };
    }

    if (requestIds.length > 0) {
      const { error: appointmentRequestDeleteError } = await adminSupabase
        .from("appointments")
        .delete()
        .in("request_id", requestIds);

      if (appointmentRequestDeleteError) {
        await reportError("delete-client", appointmentRequestDeleteError, {
          clientId,
          phase: "delete-request-appointments",
        });
        return { ok: false, error: appointmentRequestDeleteError.message };
      }
    }

    const { error: clearSelectedProposalError } = await adminSupabase
      .from("booking_requests")
      .update({ selected_proposal_id: null })
      .eq("client_id", clientId);

    if (clearSelectedProposalError) {
      await reportError("delete-client", clearSelectedProposalError, {
        clientId,
        phase: "clear-selected-proposal",
      });
      return { ok: false, error: clearSelectedProposalError.message };
    }

    const { error: requestDeleteError } = await adminSupabase
      .from("booking_requests")
      .delete()
      .eq("client_id", clientId);

    if (requestDeleteError) {
      await reportError("delete-client", requestDeleteError, { clientId, phase: "delete-requests" });
      return { ok: false, error: requestDeleteError.message };
    }

    const { error } = await adminSupabase.auth.admin.deleteUser(clientId);

    if (error) {
      await reportError("delete-client", error, { clientId });
      return { ok: false, error: error.message };
    }
  } catch (error) {
    await reportError("delete-client", error, { clientId });
    return { ok: false, error: t.feedback.couldNotUpdateClient };
  }

  // target_id is plain text, so the reference survives the row's deletion.
  await recordAdminAction("client.delete", { targetType: "profile", targetId: clientId });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.clientDeleted };
}

export async function proposeAppointmentAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = proposeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidDateTime };
  }

  const supabase = await createClient();
  const start = startsAt(parsed.data.date, parsed.data.time);

  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? t.feedback.requestNotFound };
  }

  if (request.status === "confirmed") {
    return { ok: false, error: t.feedback.alreadyConfirmed };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, duration_minutes")
    .eq("id", request.service_id)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", request.client_id)
    .single();

  const end = addMinutes(start, service.duration_minutes);

  if (
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      barberId: admin.id,
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (await hasBlockedTimeOverlap(supabase, { barberId: admin.id, start, end })) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }
  if (await hasConfirmedAppointmentOverlap(supabase, { barberId: admin.id, start, end })) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  // Supersede any earlier outstanding proposal so the client only sees the latest.
  await supabase
    .from("appointment_proposals")
    .update({ status: "expired" })
    .eq("request_id", parsed.data.requestId)
    .eq("status", "sent");

  const { data: proposal, error: proposalError } = await supabase
    .from("appointment_proposals")
    .insert({
      request_id: parsed.data.requestId,
      barber_id: admin.id,
      starts_at: start,
      ends_at: end,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (proposalError || !proposal) {
    return { ok: false, error: proposalError?.message ?? t.feedback.unableSendProposal };
  }

  await supabase
    .from("booking_requests")
    .update({ status: "proposed", selected_proposal_id: proposal.id })
    .eq("id", parsed.data.requestId);

  await supabase.from("notifications").insert({
    user_id: request.client_id,
    channel: "email",
    recipient: clientProfile?.email ?? "client",
    subject: `Appointment proposed for ${parsed.data.date} at ${parsed.data.time}`,
    body: parsed.data.note ?? null,
  });
  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: `Appointment proposed for ${parsed.data.date} at ${parsed.data.time}`,
      react: AppointmentProposedEmail({
        clientName: clientProfile.full_name ?? "there",
        service: service.name,
        date: parsed.data.date,
        time: parsed.data.time,
        note: parsed.data.note,
      }),
    });
  }

  await recordAdminAction("appointment.propose", {
    targetType: "booking_request",
    targetId: parsed.data.requestId,
    detail: { date: parsed.data.date, time: parsed.data.time },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.proposalSent };
}

export async function proposeTimeFromAdminAction(
  requestId: string,
  date: string,
  time: string,
  note: string,
): Promise<ActionResult> {
  return proposeAppointmentAction({ requestId, date, time, note });
}

// Barber confirms a client's exact-slot request as-is → a confirmed appointment.
// Other pending requests for the SAME slot are auto-declined and those clients
// notified (the slot is now taken).
export async function confirmRequestAction(requestId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const limit = await enforceRateLimit("booking:confirm-request", {
    identity: admin.id,
    limit: 60,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id, status, requested_start, requested_end")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? t.feedback.requestNotFound };
  }
  if (request.status !== "pending" || !request.requested_start || !request.requested_end) {
    return { ok: false, error: t.feedback.requestNotFound };
  }
  if (!isStartInFuture(request.requested_start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }

  // Race guard: the slot must still be bookable among confirmed appointments,
  // blocked periods, and the barber's configured opening hours.
  const requestedDate = dateInShopTimeZone(request.requested_start);
  const requestedTime = timeFromIso(request.requested_start);
  const requestedDuration = Math.round(
    (new Date(request.requested_end).getTime() - new Date(request.requested_start).getTime()) / 60000,
  );

  if (
    requestedDuration <= 0 ||
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      barberId: admin.id,
      date: requestedDate,
      time: requestedTime,
      durationMinutes: requestedDuration,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (
    await hasBlockedTimeOverlap(supabase, {
      barberId: admin.id,
      start: request.requested_start,
      end: request.requested_end,
    })
  ) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }
  if (
    await hasConfirmedAppointmentOverlap(supabase, {
      barberId: admin.id,
      start: request.requested_start,
      end: request.requested_end,
    })
  ) {
    return { ok: false, error: t.feedback.slotNoLongerFree };
  }

  // Fetch client + service details for emails (non-fatal if missing).
  const [{ data: confirmedClient }, { data: confirmedService }, { data: siblings }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", request.client_id).single(),
    supabase.from("services").select("name").eq("id", request.service_id).single(),
    supabase
      .from("booking_requests")
      .select("id, client_id")
      .eq("status", "pending")
      .eq("requested_start", request.requested_start)
      .neq("id", request.id),
  ]);

  const { data: appointmentId, error: confirmError } = await supabase.rpc("confirm_booking_request", {
    p_request_id: request.id,
    p_barber_id: admin.id,
  });

  if (confirmError || !appointmentId) {
    return { ok: false, error: t.feedback.slotNoLongerFree };
  }

  if (siblings && siblings.length > 0) {
    // Fetch sibling emails for slot-taken notifications.
    const siblingIds = siblings.map((s) => s.client_id).filter(Boolean) as string[];
    const { data: siblingProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", siblingIds);

    await supabase.from("notifications").insert(
      siblings.map((s) => ({
        user_id: s.client_id,
        channel: "email" as const,
        recipient: siblingProfiles?.find((p) => p.id === s.client_id)?.email ?? "client",
        subject: "Your requested time was just booked — please pick another",
      })),
    );

    // Send slot-taken emails to each displaced sibling.
    for (const sibling of siblingProfiles ?? []) {
      if (sibling.email) {
        await sendEmail({
          to: sibling.email,
          subject: "Your requested time was just booked — please pick another",
          react: SlotTakenEmail({ clientName: sibling.full_name ?? "there" }),
        });
      }
    }
  }

  await supabase.from("notifications").insert({
    user_id: request.client_id,
    channel: "email",
    recipient: confirmedClient?.email ?? "client",
    subject: "Your appointment is confirmed",
  });
  if (confirmedClient?.email) {
    await sendEmail({
      to: confirmedClient.email,
      subject: "Your appointment is confirmed",
      react: AppointmentConfirmedEmail({
        clientName: confirmedClient.full_name ?? "there",
        service: confirmedService?.name ?? "",
        date: requestedDate,
        time: requestedTime,
        appointmentId,
        startIso: request.requested_start,
        endIso: request.requested_end,
      }),
    });
  }

  await recordAdminAction("request.confirm", {
    targetType: "appointment",
    targetId: appointmentId,
    detail: { date: requestedDate, time: requestedTime },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return {
    ok: true,
    message:
      siblings && siblings.length > 0
        ? t.feedback.confirmedAndDeclinedOthers
        : t.feedback.requestConfirmed,
  };
}

// Move a confirmed appointment: free its slot now and send the client a fresh
// proposal for the new time. The booking reverts to "proposed" until accepted.
export async function rescheduleAppointmentAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = rescheduleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidNewDateTime };
  }

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, request_id, client_id, service_id, status")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { ok: false, error: appointmentError?.message ?? t.feedback.appointmentNotFound };
  }

  if (!appointment.request_id) {
    return {
      ok: false,
      error: t.feedback.walkInNoReschedule,
    };
  }

  const start = startsAt(parsed.data.date, parsed.data.time);
  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", appointment.service_id)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const end = addMinutes(start, service.duration_minutes);

  if (
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      barberId: admin.id,
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (await hasBlockedTimeOverlap(supabase, { barberId: admin.id, start, end })) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }

  // Conflict-check the new slot against *other* confirmed appointments, using a
  // half-open interval overlap [start, end): an existing booking clashes when it
  // starts before our end AND ends after our start. (Exact-start alone misses
  // partial overlaps like 16:00–17:15 vs a new 17:00 start.)
  if (
    await hasConfirmedAppointmentOverlap(supabase, {
      barberId: admin.id,
      start,
      end,
      excludeAppointmentId: appointment.id,
    })
  ) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  const [{ data: clientProfile }, { data: rescheduleService }] = await Promise.all([
    appointment.client_id
      ? supabase.from("profiles").select("email, full_name").eq("id", appointment.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("services").select("name").eq("id", appointment.service_id).single(),
  ]);

  // Free the current slot.
  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointment.id);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  // Supersede any earlier outstanding proposal, then send the new one.
  await supabase
    .from("appointment_proposals")
    .update({ status: "expired" })
    .eq("request_id", appointment.request_id)
    .eq("status", "sent");

  const { data: proposal, error: proposalError } = await supabase
    .from("appointment_proposals")
    .insert({
      request_id: appointment.request_id,
      barber_id: admin.id,
      starts_at: start,
      ends_at: end,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (proposalError || !proposal) {
    return { ok: false, error: proposalError?.message ?? t.feedback.unableSendNewTime };
  }

  await supabase
    .from("booking_requests")
    .update({ status: "proposed", selected_proposal_id: proposal.id })
    .eq("id", appointment.request_id);

  await supabase.from("notifications").insert({
    user_id: appointment.client_id,
    channel: "email",
    recipient: clientProfile?.email ?? "client",
    subject: `Your appointment was moved — new time proposed for ${parsed.data.date} at ${parsed.data.time}`,
    body: parsed.data.note ?? null,
  });
  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: `Your appointment was moved — new time proposed for ${parsed.data.date} at ${parsed.data.time}`,
      react: AppointmentRescheduledEmail({
        clientName: clientProfile.full_name ?? "there",
        service: rescheduleService?.name ?? "",
        date: parsed.data.date,
        time: parsed.data.time,
        note: parsed.data.note,
      }),
    });
  }

  await recordAdminAction("appointment.reschedule", {
    targetType: "appointment",
    targetId: parsed.data.appointmentId,
    detail: { date: parsed.data.date, time: parsed.data.time },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.slotFreedProposed };
}

// Cancel a confirmed appointment from the calendar. Frees the slot; for a
// client booking it also cancels the request and notifies the client.
export async function cancelAppointmentAdminAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = cancelAppointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.couldNotCancelAppointment };
  }

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, request_id, client_id, service_id, starts_at")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { ok: false, error: appointmentError?.message ?? t.feedback.appointmentNotFound };
  }

  const [{ data: clientProfile }, { data: cancelService }] = await Promise.all([
    appointment.client_id
      ? supabase.from("profiles").select("email, full_name").eq("id", appointment.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("services").select("name").eq("id", appointment.service_id).single(),
  ]);

  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointment.id);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (appointment.request_id) {
    await supabase
      .from("appointment_proposals")
      .update({ status: "expired" })
      .eq("request_id", appointment.request_id)
      .eq("status", "sent");

    await supabase
      .from("booking_requests")
      .update({ status: "cancelled" })
      .eq("id", appointment.request_id);
  }

  // Walk-ins (no client_id) have nobody to notify.
  if (appointment.client_id && clientProfile?.email) {
    const cancelDate = dateInShopTimeZone(appointment.starts_at);
    const cancelTime = timeFromIso(appointment.starts_at);
    await supabase.from("notifications").insert({
      user_id: appointment.client_id,
      channel: "email",
      recipient: clientProfile.email,
      subject: "Your appointment was cancelled",
      body: parsed.data.note ?? null,
    });
    await sendEmail({
      to: clientProfile.email,
      subject: "Your appointment was cancelled",
      react: AppointmentCancelledEmail({
        clientName: clientProfile.full_name ?? "there",
        service: cancelService?.name ?? "",
        date: cancelDate,
        time: cancelTime,
        note: parsed.data.note,
      }),
    });
  }

  await recordAdminAction("appointment.cancel", {
    targetType: "appointment",
    targetId: parsed.data.appointmentId,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.appointmentCancelled };
}

export async function createAdminBookingAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = adminBookingSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return {
      ok: false,
      error: issue === "client-or-walkin" ? t.feedback.chooseClientOrWalkIn : t.feedback.fillBookingDetails,
    };
  }

  const supabase = await createClient();
  const start = startsAt(parsed.data.date, parsed.data.time);

  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }

  // An existing client must be a real, non-admin profile.
  if (parsed.data.clientId) {
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", parsed.data.clientId)
      .maybeSingle();

    if (!clientProfile || clientProfile.role === "admin") {
      return { ok: false, error: t.feedback.chooseValidClient };
    }
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", parsed.data.serviceId)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const end = addMinutes(start, service.duration_minutes);

  if (
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      barberId: admin.id,
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (await hasBlockedTimeOverlap(supabase, { barberId: admin.id, start, end })) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }

  // Pre-check the slot for any OVERLAP with confirmed appointments (half-open
  // interval [start, end)): a booking clashes when it starts before our end AND
  // ends after our start. The appointments_unique_start index is the hard
  // backstop for the exact-start race, but only overlap-checking here stops a new
  // booking from landing partway inside an existing one (e.g. 17:00 over 16:00–17:15).
  if (await hasConfirmedAppointmentOverlap(supabase, { barberId: admin.id, start, end })) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  const { error: insertError } = await supabase.from("appointments").insert({
    request_id: null,
    proposal_id: null,
    client_id: parsed.data.clientId ?? null,
    customer_name: parsed.data.customerName ?? null,
    barber_id: admin.id,
    service_id: parsed.data.serviceId,
    starts_at: start,
    ends_at: end,
  });

  if (insertError) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  await recordAdminAction("appointment.create", {
    targetType: "appointment",
    detail: {
      date: parsed.data.date,
      time: parsed.data.time,
      walkIn: !parsed.data.clientId,
    },
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.bookingAdded };
}

export async function respondToProposalAction(
  proposalId: string,
  accepted: boolean,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const limit = await enforceRateLimit("booking:respond-proposal", {
    identity: profile.id,
    limit: 30,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const supabase = await createClient();

  const { data: proposal, error } = await supabase
    .from("appointment_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (error || !proposal) {
    return { ok: false, error: error?.message ?? t.feedback.proposalNotFound };
  }

  if (proposal.status !== "sent") {
    return { ok: false, error: t.feedback.proposalClosed };
  }
  if (!isStartInFuture(proposal.starts_at)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  if (!isStartInClientBookingWindow(proposal.starts_at)) {
    return { ok: false, error: t.feedback.chooseWithinTwoWeeks };
  }

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id")
    .eq("id", proposal.request_id)
    .single();

  // Fetch service name for the response email (non-fatal if missing).
  const { data: respondService } = request
    ? await supabase.from("services").select("name").eq("id", request.service_id).single()
    : { data: null };

  if (requestError || !request || request.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotRespond };
  }

  if (accepted) {
    // Guard against the slot being taken, blocked, or moved outside configured
    // hours between proposal and confirmation.
    const proposalDate = dateInShopTimeZone(proposal.starts_at);
    const proposalTime = timeFromIso(proposal.starts_at);
    const proposalDuration = Math.round(
      (new Date(proposal.ends_at).getTime() - new Date(proposal.starts_at).getTime()) / 60000,
    );

    if (
      proposalDuration <= 0 ||
      !(await isSlotInsideConfiguredBusinessHours(supabase, {
        barberId: proposal.barber_id,
        date: proposalDate,
        time: proposalTime,
        durationMinutes: proposalDuration,
      }))
    ) {
      return { ok: false, error: t.feedback.slotOutsideHours };
    }
    if (
      await hasBlockedTimeOverlap(supabase, {
        barberId: proposal.barber_id,
        start: proposal.starts_at,
        end: proposal.ends_at,
      })
    ) {
      return { ok: false, error: t.feedback.slotUnavailable };
    }
    if (
      await hasConfirmedAppointmentOverlap(supabase, {
        barberId: proposal.barber_id,
        start: proposal.starts_at,
        end: proposal.ends_at,
      })
    ) {
      return { ok: false, error: t.feedback.timeJustTaken };
    }

  }

  const { error: responseError } = await supabase.rpc("respond_to_appointment_proposal", {
    p_proposal_id: proposalId,
    p_client_id: profile.id,
    p_accepted: accepted,
  });

  if (responseError) {
    return { ok: false, error: accepted ? t.feedback.timeJustTaken : t.feedback.cannotRespond };
  }

  const barberEmailForResponse = getBarberEmail();
  const respondDate = dateInShopTimeZone(proposal.starts_at);
  const respondTime = timeFromIso(proposal.starts_at);
  const respondSubject = accepted
    ? `${profile.full_name} confirmed the appointment`
    : `${profile.full_name} declined the proposed time`;

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: barberEmailForResponse,
    subject: respondSubject,
  });
  await sendEmail({
    to: barberEmailForResponse,
    subject: respondSubject,
    react: ClientRespondedEmail({
      clientName: profile.full_name,
      service: respondService?.name ?? "",
      date: respondDate,
      time: respondTime,
      accepted,
    }),
  });

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: accepted ? t.feedback.appointmentConfirmed : t.feedback.proposalDeclined,
  };
}

export async function redirectToDashboardAction() {
  const profile = await requireProfile();
  redirect(dashboardPathFor(profile));
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfileAction(input: {
  fullName: string;
  phone: string;
}): Promise<ActionResult> {
  const profile = await requireProfile();
  const t = await getDict();
  const parsed = profileSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.enterValidNamePhone };
  }

  const phone = parsed.data.phone.trim();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone })
    .eq("id", profile.id);

  if (error) {
    return {
      ok: false,
      error: isDuplicatePhoneError(error.message) ? t.feedback.phoneTaken : error.message,
    };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.profileUpdated };
}

// Google OAuth users never type a phone number. After sign-in they are routed
// to /complete-profile, which calls this to set a unique, populated phone before
// they can use the app.
export async function completePhoneAction(input: { phone: string }): Promise<ActionResult> {
  const profile = await requireProfile();
  const t = await getDict();
  const parsed = z.object({ phone: z.string().trim().min(4).max(40) }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.enterValidNamePhone };
  }

  const phone = parsed.data.phone.trim();
  const supabase = await createClient();

  if (await isPhoneTaken(supabase, phone)) {
    return { ok: false, error: t.feedback.phoneTaken };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ phone })
    .eq("id", profile.id);

  if (error) {
    return {
      ok: false,
      error: isDuplicatePhoneError(error.message) ? t.feedback.phoneTaken : error.message,
    };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.profileUpdated };
}

// ---------------------------------------------------------------------------
// Profile picture — stored in the public `avatars` bucket under a per-user
// folder (avatars/{id}/…). One file per user (upsert), so storage never grows
// unbounded. A cache-buster query keeps next/image from serving a stale photo.
// ---------------------------------------------------------------------------

const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const AVATAR_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  const t = await getDict();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t.feedback.avatarUploadFailed };
  }

  const ext = AVATAR_EXT[file.type];
  if (!ext) {
    return { ok: false, error: t.feedback.invalidImageType };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: t.feedback.imageTooLarge };
  }

  const supabase = await createClient();
  const path = `${profile.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", profile.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.avatarUpdated };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const profile = await requireProfile();
  const t = await getDict();
  const supabase = await createClient();

  // Remove every known extension variant; ignore "not found".
  await supabase.storage
    .from("avatars")
    .remove(Object.values(AVATAR_EXT).map((ext) => `${profile.id}/avatar.${ext}`));

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.avatarRemoved };
}

// ---------------------------------------------------------------------------
// Services (admin) — soft delete via `active`, never hard delete.
// ---------------------------------------------------------------------------

export async function createServiceAction(input: {
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  imageUrl?: string;
}): Promise<ActionResult & { id?: string }> {
  await requireAdmin();
  const t = await getDict();
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.checkServiceFields };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.durationMinutes,
      price_cents: parsed.data.priceCents,
      image_url: parsed.data.imageUrl?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("service.create", {
    targetType: "service",
    targetId: data.id,
    detail: { name: parsed.data.name },
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.serviceAdded, id: data.id };
}

export async function updateServiceAction(
  serviceId: string,
  input: {
    name: string;
    description?: string;
    durationMinutes: number;
    priceCents: number;
    imageUrl?: string;
  },
): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.checkServiceFields };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.durationMinutes,
      price_cents: parsed.data.priceCents,
      image_url: parsed.data.imageUrl?.trim() || null,
    })
    .eq("id", serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("service.update", {
    targetType: "service",
    targetId: serviceId,
    detail: { name: parsed.data.name },
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.serviceUpdated };
}

export async function toggleServiceActiveAction(
  serviceId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("service.toggle", {
    targetType: "service",
    targetId: serviceId,
    detail: { active },
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: active ? t.feedback.serviceActivated : t.feedback.serviceHidden };
}

// ---------------------------------------------------------------------------
// Service images — stored in the public `service-images` bucket under
// services/{serviceId}.{ext}. One file per service (upsert). Admin-only.
// ---------------------------------------------------------------------------

const SERVICE_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const SERVICE_IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadServiceImageAction(
  serviceId: string,
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  await requireAdmin();
  const t = await getDict();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t.feedback.avatarUploadFailed };
  }

  const ext = SERVICE_IMAGE_EXT[file.type];
  if (!ext) {
    return { ok: false, error: t.feedback.invalidImageType };
  }
  if (file.size > SERVICE_IMAGE_MAX_BYTES) {
    return { ok: false, error: t.feedback.imageTooLarge };
  }

  const supabase = await createClient();
  const path = `services/${serviceId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("service-images")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage
    .from("service-images")
    .getPublicUrl(path);
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("services")
    .update({ image_url: publicUrl })
    .eq("id", serviceId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.serviceImageUpdated, url: publicUrl };
}

// ---------------------------------------------------------------------------
// Availability — vacation / blocked days (blocked_times)
// ---------------------------------------------------------------------------

export async function blockDateAction(input: {
  start: string;
  end: string;
  reason?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = blockDateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidStartEnd };
  }

  if (parsed.data.end < parsed.data.start) {
    return { ok: false, error: t.feedback.endAfterStart };
  }

  const supabase = await createClient();

  // Partial-day block: a time slice (break / partial time-off) on the start date.
  const isSlice = Boolean(parsed.data.startTime && parsed.data.endTime);
  let starts: string;
  let ends: string;
  if (isSlice) {
    if (parsed.data.endTime! <= parsed.data.startTime!) {
      return { ok: false, error: t.feedback.endAfterStart };
    }
    starts = zonedDateTimeToUtcIso(parsed.data.start, parsed.data.startTime!);
    ends = zonedDateTimeToUtcIso(parsed.data.start, parsed.data.endTime!);
  } else {
    // Block the whole day(s): start at 00:00, end at 23:59:59 of the end date.
    starts = new Date(`${parsed.data.start}T00:00:00`).toISOString();
    ends = new Date(`${parsed.data.end}T23:59:59`).toISOString();
  }

  const { error } = await supabase.from("blocked_times").insert({
    barber_id: admin.id,
    starts_at: starts,
    ends_at: ends,
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("availability.block", {
    targetType: "blocked_time",
    detail: { start: starts, end: ends, slice: isSlice },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.datesBlocked };
}

export async function unblockDateAction(blockId: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_times").delete().eq("id", blockId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("availability.unblock", {
    targetType: "blocked_time",
    targetId: blockId,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.datesReopened };
}

// ---------------------------------------------------------------------------
// Appointment outcome — admin marks past appointments as completed / no-show.
// ---------------------------------------------------------------------------

export async function markAppointmentOutcomeAction(
  appointmentId: string,
  outcome: "completed" | "no_show",
): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ outcome })
    .eq("id", appointmentId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("appointment.outcome", {
    targetType: "appointment",
    targetId: appointmentId,
    detail: { outcome },
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.outcomeRecorded };
}

// ---------------------------------------------------------------------------
// Client cancel — pending/proposed only (no RLS path to undo a confirmed
// appointment from the client side).
// ---------------------------------------------------------------------------

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("booking_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    return { ok: false, error: error?.message ?? t.feedback.requestNotFound };
  }

  if (request.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }

  if (request.status === "confirmed") {
    return { ok: false, error: t.feedback.cannotCancelConfirmed };
  }

  // Expire any outstanding proposal, then cancel the request.
  await supabase
    .from("appointment_proposals")
    .update({ status: "expired" })
    .eq("request_id", requestId)
    .eq("status", "sent");

  const { error: cancelError } = await supabase
    .from("booking_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  if (cancelError) {
    return { ok: false, error: cancelError.message };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.requestCancelled };
}

// ---------------------------------------------------------------------------
// Business hours — weekly schedule config (admin only).
// Upserts all 7 weekday rows in one call; the unique (barber_id, weekday)
// constraint handles conflicts so there's never a duplicate row.
// ---------------------------------------------------------------------------

export async function saveBusinessHoursAction(
  days: Array<{
    weekday: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }>,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = businessHoursSchema.safeParse(days);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidDateTime };
  }

  const supabase = await createClient();

  const rows = parsed.data.map((d) => ({
    barber_id: admin.id,
    weekday: d.weekday,
    opens_at: d.opensAt,
    closes_at: d.closesAt,
    closed: d.closed,
  }));

  const { error } = await supabase
    .from("business_hours")
    .upsert(rows, { onConflict: "barber_id,weekday" });

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("business_hours.update", { targetType: "business_hours" });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.businessHoursSaved };
}

// ---------------------------------------------------------------------------
// Client self-service over CONFIRMED appointments (migration 0020 RPCs).
// The client cannot mutate confirmed rows directly under RLS, so these call
// SECURITY DEFINER functions that enforce ownership + a 24h lead-time in SQL.
// ---------------------------------------------------------------------------

// Lead-time cutoff mirrored from the SQL guard for a friendly early message.
const CANCEL_LEAD_MS = 24 * 60 * 60 * 1000;

/** True when the appointment starts more than 24h from now. */
function moreThan24hAway(startIso: string): boolean {
  return new Date(startIso).getTime() - Date.now() > CANCEL_LEAD_MS;
}

export async function cancelConfirmedAppointmentAction(
  appointmentId: string,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, client_id, service_id, starts_at, status")
    .eq("id", appointmentId)
    .single();

  if (error || !appointment || appointment.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }
  if (appointment.status !== "confirmed") {
    return { ok: false, error: t.feedback.cannotCancelConfirmed };
  }
  if (!moreThan24hAway(appointment.starts_at)) {
    return { ok: false, error: t.feedback.appointmentTooLateToCancel };
  }

  const { error: cancelError } = await supabase.rpc(
    "client_cancel_confirmed_appointment",
    { p_appointment_id: appointmentId },
  );
  if (cancelError) {
    return { ok: false, error: t.feedback.appointmentTooLateToCancel };
  }

  // Notify the barber (email + notification row), non-fatal on failure.
  const barberEmail = getBarberEmail();
  const cancelDate = dateInShopTimeZone(appointment.starts_at);
  const cancelTime = timeFromIso(appointment.starts_at);
  const { data: cancelService } = await supabase
    .from("services")
    .select("name")
    .eq("id", appointment.service_id)
    .single();
  const cancelSubject = `${profile.full_name} cancelled ${cancelDate} at ${cancelTime}`;
  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: barberEmail,
    subject: cancelSubject,
  });
  await sendEmail({
    to: barberEmail,
    subject: cancelSubject,
    react: ClientRespondedEmail({
      clientName: profile.full_name,
      service: cancelService?.name ?? "",
      date: cancelDate,
      time: cancelTime,
      accepted: false,
    }),
  });

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.appointmentCancelledSelf };
}

export async function requestRescheduleAction(
  appointmentId: string,
  date: string,
  time: string,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();

  const limit = await enforceRateLimit("booking:request-reschedule", {
    identity: profile.id,
    limit: 20,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, client_id, barber_id, service_id, starts_at, ends_at, status")
    .eq("id", appointmentId)
    .single();

  if (error || !appointment || appointment.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }
  if (appointment.status !== "confirmed") {
    return { ok: false, error: t.feedback.cannotCancelConfirmed };
  }
  if (!moreThan24hAway(appointment.starts_at)) {
    return { ok: false, error: t.feedback.rescheduleTooLate };
  }

  const newStart = startsAt(date, time);
  const durationMinutes = Math.round(
    (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000,
  );
  const newEnd = addMinutes(newStart, durationMinutes);

  // Validate the requested new time the same way a fresh booking is validated.
  if (!moreThan24hAway(newStart)) {
    return { ok: false, error: t.feedback.rescheduleTooLate };
  }
  if (!isStartInFuture(newStart)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  if (!isStartInClientBookingWindow(newStart)) {
    return { ok: false, error: t.feedback.chooseWithinTwoWeeks };
  }
  if (
    !(await isSlotInsideConfiguredBusinessHours(supabase, {
      barberId: appointment.barber_id,
      date,
      time,
      durationMinutes,
    }))
  ) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  if (
    await hasBlockedTimeOverlap(supabase, {
      barberId: appointment.barber_id,
      start: newStart,
      end: newEnd,
    })
  ) {
    return { ok: false, error: t.feedback.slotUnavailable };
  }

  const { error: rescheduleError } = await supabase.rpc("client_request_reschedule", {
    p_appointment_id: appointmentId,
    p_new_start: newStart,
  });
  if (rescheduleError) {
    return { ok: false, error: t.feedback.slotNoLongerFree };
  }

  // Notify the barber that a confirmed slot needs re-confirming at a new time.
  const barberEmail = getBarberEmail();
  const { data: rescheduleService } = await supabase
    .from("services")
    .select("name")
    .eq("id", appointment.service_id)
    .single();
  const rescheduleSubject = `${profile.full_name} asked to move to ${date} at ${time}`;
  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: barberEmail,
    subject: rescheduleSubject,
  });
  await sendEmail({
    to: barberEmail,
    subject: rescheduleSubject,
    react: BookingRequestEmail({
      clientName: profile.full_name,
      service: rescheduleService?.name ?? "",
      date,
      time,
      note: undefined,
    }),
  });

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.rescheduleRequested };
}

// ---------------------------------------------------------------------------
// GDPR self-service — the client can export or delete their own data.
// ---------------------------------------------------------------------------

/** Assemble the caller's own data as a JSON string for download (GDPR access). */
export async function exportMyDataAction(): Promise<
  { ok: true; data: string } | { ok: false; error: string }
> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();

  const [requests, appointments, notifications] = await Promise.all([
    supabase.from("booking_requests").select("*").eq("client_id", profile.id),
    supabase.from("appointments").select("*").eq("client_id", profile.id),
    supabase.from("notifications").select("*").eq("user_id", profile.id),
  ]);

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, approval_status, created_at")
    .eq("id", profile.id)
    .single();

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: profileRow ?? null,
    bookingRequests: requests.data ?? [],
    appointments: appointments.data ?? [],
    notifications: notifications.data ?? [],
  };

  if (requests.error || appointments.error || notifications.error) {
    return { ok: false, error: t.common.somethingWentWrong };
  }

  return { ok: true, data: JSON.stringify(payload, null, 2) };
}

/**
 * Permanently delete the caller's own account and data (GDPR erasure). Mirrors
 * the admin deleteClientAction sequence but scoped to auth.uid(), using the
 * service-role client to clear rows and remove the auth user.
 */
export async function deleteMyAccountAction(): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();

  const limit = await enforceRateLimit("account:self-delete", {
    identity: profile.id,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const clientId = profile.id;
  try {
    const adminSupabase = getSupabaseAdminClient();

    const { data: requests } = await adminSupabase
      .from("booking_requests")
      .select("id")
      .eq("client_id", clientId);
    const requestIds = (requests ?? []).map((r) => r.id);

    await adminSupabase.from("appointments").delete().eq("client_id", clientId);
    if (requestIds.length > 0) {
      await adminSupabase.from("appointments").delete().in("request_id", requestIds);
    }
    await adminSupabase
      .from("booking_requests")
      .update({ selected_proposal_id: null })
      .eq("client_id", clientId);
    await adminSupabase.from("booking_requests").delete().eq("client_id", clientId);

    const { error } = await adminSupabase.auth.admin.deleteUser(clientId);
    if (error) {
      await reportError("self-delete", error, { clientId });
      return { ok: false, error: t.feedback.couldNotDeleteAccount };
    }
  } catch (error) {
    await reportError("self-delete", error, { clientId });
    return { ok: false, error: t.feedback.couldNotDeleteAccount };
  }

  // Sign out (their session is now orphaned) and send them to login.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent(t.feedback.accountDeleted)}`);
}

// ---------------------------------------------------------------------------
// Notification center — mark the client's own notifications read (0020 policy).
// ---------------------------------------------------------------------------
export async function markNotificationsReadAction(): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.notificationsMarkedRead };
}
