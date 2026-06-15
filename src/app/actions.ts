"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_VERSION } from "@/lib/consent/config";
import { dashboardPathFor, getCurrentProfile, requireAdmin, requireApprovedClient, requireProfile } from "@/server/auth";
import type { ActionResult, Preference } from "@/domain/types";
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

const preferenceSchema = z.object({
  rank: z.number().int().min(1).max(3),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window: z.enum(["Morning", "Midday", "Afternoon", "Evening"]),
});

const createRequestSchema = z.object({
  serviceId: z.uuid(),
  note: z.string().max(1000).optional(),
  preferences: z.array(preferenceSchema).length(3),
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
});

const blockDateSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function startsAt(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: input.data.fullName,
        phone: input.data.phone,
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
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

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .insert({
      client_id: profile.id,
      service_id: parsed.data.serviceId,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? t.feedback.unableCreateRequest };
  }

  const { error: preferencesError } = await supabase
    .from("booking_preferences")
    .insert(
      parsed.data.preferences.map((preference) => ({
        request_id: request.id,
        rank: preference.rank,
        preferred_date: preference.date,
        day_window: preference.window,
      })),
    );

  if (preferencesError) {
    return { ok: false, error: preferencesError.message };
  }

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: "barber@samuelssoncuts.com",
    subject: `${profile.full_name} requested an appointment`,
  });

  revalidatePath("/client", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.requestSent };
}

export async function createRequestFromClientAction(
  serviceId: string,
  preferences: Preference[],
  note: string,
): Promise<ActionResult> {
  return createBookingRequestAction({ serviceId, preferences, note });
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

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.registrationRejected };
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

  if (new Date(start).getTime() < Date.now()) {
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
    .select("duration_minutes")
    .eq("id", request.service_id)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", request.client_id)
    .single();

  const end = addMinutes(start, service.duration_minutes);

  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", admin.id)
    .eq("starts_at", start)
    .eq("status", "confirmed")
    .maybeSingle();

  if (existing) {
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
  if (new Date(start).getTime() < Date.now()) {
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

  // Conflict-check the new slot against *other* confirmed appointments.
  const { data: clash } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", admin.id)
    .eq("starts_at", start)
    .eq("status", "confirmed")
    .neq("id", appointment.id)
    .maybeSingle();

  if (clash) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  const { data: clientProfile } = appointment.client_id
    ? await supabase
        .from("profiles")
        .select("email")
        .eq("id", appointment.client_id)
        .single()
    : { data: null };

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
    .select("id, request_id, client_id")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { ok: false, error: appointmentError?.message ?? t.feedback.appointmentNotFound };
  }

  const { data: clientProfile } = appointment.client_id
    ? await supabase
        .from("profiles")
        .select("email")
        .eq("id", appointment.client_id)
        .single()
    : { data: null };

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
  if (appointment.client_id) {
    await supabase.from("notifications").insert({
      user_id: appointment.client_id,
      channel: "email",
      recipient: clientProfile?.email ?? "client",
      subject: "Your appointment was cancelled",
      body: parsed.data.note ?? null,
    });
  }

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

  if (new Date(start).getTime() < Date.now()) {
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

  // Pre-check the slot; the appointments_unique_start index is the hard backstop.
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", admin.id)
    .eq("starts_at", start)
    .eq("status", "confirmed")
    .maybeSingle();

  if (existing) {
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

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.bookingAdded };
}

export async function respondToProposalAction(
  proposalId: string,
  accepted: boolean,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
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

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id")
    .eq("id", proposal.request_id)
    .single();

  if (requestError || !request || request.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotRespond };
  }

  if (accepted) {
    // Guard against the slot being taken between proposal and confirmation.
    const { data: clash } = await supabase
      .from("appointments")
      .select("id")
      .eq("barber_id", proposal.barber_id)
      .eq("starts_at", proposal.starts_at)
      .eq("status", "confirmed")
      .maybeSingle();

    if (clash) {
      return { ok: false, error: t.feedback.timeJustTaken };
    }

    const { error: appointmentError } = await supabase.from("appointments").insert({
      request_id: request.id,
      proposal_id: proposal.id,
      client_id: profile.id,
      barber_id: proposal.barber_id,
      service_id: request.service_id,
      starts_at: proposal.starts_at,
      ends_at: proposal.ends_at,
    });

    if (appointmentError) {
      return { ok: false, error: t.feedback.timeJustTaken };
    }
  }

  await supabase
    .from("appointment_proposals")
    .update({ status: accepted ? "accepted" : "declined" })
    .eq("id", proposalId);

  await supabase
    .from("booking_requests")
    .update({ status: accepted ? "confirmed" : "declined" })
    .eq("id", request.id);

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: "barber@samuelssoncuts.com",
    subject: accepted ? "Client confirmed appointment" : "Client declined proposed time",
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: error.message };
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
}): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.checkServiceFields };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: parsed.data.priceCents,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.serviceAdded };
}

export async function updateServiceAction(
  serviceId: string,
  input: {
    name: string;
    description?: string;
    durationMinutes: number;
    priceCents: number;
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
    })
    .eq("id", serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

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

  revalidatePath("/admin", "layout");
  return { ok: true, message: active ? t.feedback.serviceActivated : t.feedback.serviceHidden };
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
  // Block the whole day(s): start at 00:00, end at 23:59:59 of the end date.
  const starts = new Date(`${parsed.data.start}T00:00:00`).toISOString();
  const ends = new Date(`${parsed.data.end}T23:59:59`).toISOString();

  const { error } = await supabase.from("blocked_times").insert({
    barber_id: admin.id,
    starts_at: starts,
    ends_at: ends,
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

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

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.datesReopened };
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
