"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathFor, requireAdmin, requireApprovedClient, requireProfile } from "@/server/auth";
import type { ActionResult, Preference } from "@/domain/types";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
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
  const input = signInSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!input.success) {
    redirect("/login?error=Check your email and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const input = registerSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
  });

  if (!input.success) {
    redirect("/register?error=Fill all fields correctly. Password must have at least 8 characters.");
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

  redirect("/login?message=Registration created. Confirm your email if required, then wait for barber approval.");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createBookingRequestAction(input: unknown): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const parsed = createRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Pick a service and three preferred days." };
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
    return { ok: false, error: requestError?.message ?? "Unable to create booking request." };
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
  return { ok: true, message: "Request sent. The barber will propose a time." };
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
  const supabase = await createClient();

  // Don't approve anyone who hasn't verified their email yet.
  const { data: candidate } = await supabase
    .from("profiles")
    .select("email_confirmed_at")
    .eq("id", clientId)
    .single();

  if (!candidate?.email_confirmed_at) {
    return { ok: false, error: "This client has not confirmed their email yet." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", clientId)
    .select("id, email, full_name")
    .single();

  if (error || !profile) {
    return { ok: false, error: error?.message ?? "Could not approve this client." };
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
  return { ok: true, message: "Client approved." };
}

export async function rejectClientAction(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", clientId)
    .select("id, email, full_name")
    .single();

  if (error || !profile) {
    return { ok: false, error: error?.message ?? "Could not update this client." };
  }

  await supabase.from("notifications").insert({
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Update on your Samuelsson Cuts account",
    body: `Hi ${profile.full_name}, we are unable to approve your account at this time.`,
  });

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Registration rejected." };
}

export async function proposeAppointmentAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = proposeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Pick a valid date and time before sending." };
  }

  const supabase = await createClient();
  const start = startsAt(parsed.data.date, parsed.data.time);

  if (new Date(start).getTime() < Date.now()) {
    return { ok: false, error: "Choose a time in the future." };
  }

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? "Booking request not found." };
  }

  if (request.status === "confirmed") {
    return { ok: false, error: "This request is already confirmed." };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", request.service_id)
    .single();

  if (serviceError || !service) {
    return { ok: false, error: serviceError?.message ?? "Service not found." };
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
    return { ok: false, error: "That slot is already booked. Pick another time." };
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
    return { ok: false, error: proposalError?.message ?? "Unable to send proposal." };
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
  return { ok: true, message: "Proposal sent to the client." };
}

export async function proposeTimeFromAdminAction(
  requestId: string,
  date: string,
  time: string,
  note: string,
): Promise<ActionResult> {
  return proposeAppointmentAction({ requestId, date, time, note });
}

export async function respondToProposalAction(
  proposalId: string,
  accepted: boolean,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const supabase = await createClient();

  const { data: proposal, error } = await supabase
    .from("appointment_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (error || !proposal) {
    return { ok: false, error: error?.message ?? "Proposal not found." };
  }

  if (proposal.status !== "sent") {
    return { ok: false, error: "This proposal is no longer open." };
  }

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id")
    .eq("id", proposal.request_id)
    .single();

  if (requestError || !request || request.client_id !== profile.id) {
    return { ok: false, error: "You cannot respond to this proposal." };
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
      return { ok: false, error: "That time was just booked. Ask for a new proposal." };
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
      return { ok: false, error: "That time was just booked. Ask for a new proposal." };
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
    message: accepted ? "Appointment confirmed." : "Proposal declined.",
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
  const parsed = profileSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Enter a valid name and phone number." };
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
  return { ok: true, message: "Profile updated." };
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
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Check the service name, duration, and price." };
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
  return { ok: true, message: "Service added." };
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
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Check the service name, duration, and price." };
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
  return { ok: true, message: "Service updated." };
}

export async function toggleServiceActiveAction(
  serviceId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message: active ? "Service activated." : "Service hidden." };
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
  const parsed = blockDateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Pick valid start and end dates." };
  }

  if (parsed.data.end < parsed.data.start) {
    return { ok: false, error: "End date must be on or after the start date." };
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
  return { ok: true, message: "Dates blocked." };
}

export async function unblockDateAction(blockId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_times").delete().eq("id", blockId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: "Dates reopened." };
}

// ---------------------------------------------------------------------------
// Client cancel — pending/proposed only (no RLS path to undo a confirmed
// appointment from the client side).
// ---------------------------------------------------------------------------

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("booking_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    return { ok: false, error: error?.message ?? "Request not found." };
  }

  if (request.client_id !== profile.id) {
    return { ok: false, error: "You cannot cancel this request." };
  }

  if (request.status === "confirmed") {
    return { ok: false, error: "Confirmed appointments can't be cancelled here." };
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
  return { ok: true, message: "Request cancelled." };
}
