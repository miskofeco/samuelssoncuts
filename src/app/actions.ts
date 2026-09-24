"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
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
import { BookingRequestDeclinedEmail } from "@/emails/booking-request-declined";
import { ClientRespondedEmail } from "@/emails/client-responded";
import { SlotTakenEmail } from "@/emails/slot-taken";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteClientAccount } from "@/server/account-deletion";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysToDate,
  zonedDateTimeToUtcIso,
  timeInShopTimeZone,
  dateInShopTimeZone,
} from "@/lib/time-zone";
import { CONSENT_VERSION } from "@/lib/consent/config";
import {
  BLOCK_REASON_MAX_LENGTH,
  BLOCK_REASON_MIN_LENGTH,
  isStartInClientBookingWindow,
  isStartInFuture,
  minutesOf,
} from "@/domain/schedule";
import {
  guardSlot,
} from "@/server/booking-guards";
import { dashboardPathFor, getCurrentProfile, requireAdmin, requireApprovedClient, requireProfile } from "@/server/auth";
import { isReadyForApproval } from "@/domain/approval";
import { authErrorKind } from "@/domain/auth-errors";
import type { AuthFormState } from "@/domain/auth-form";
import { OAUTH_INTENT_COOKIE, oauthStartPath, parseOAuthIntent } from "@/domain/oauth-landing";
import { parsePhone } from "@/domain/phone";
import type { BookingContact } from "@/domain/shop-contact";
import {
  accountApprovedPush,
  accountBlockedPush,
  accountRejectedPush,
  adminClientCancelledPush,
  adminNewRequestPush,
  adminProposalResponsePush,
  adminRescheduleRequestPush,
  clientCancelledPush,
  clientConfirmedPush,
  clientProposedPush,
  clientRequestDeclinedPush,
  clientRequestReceivedPush,
  clientRescheduledPush,
  clientSlotTakenPush,
} from "@/domain/push-copy";
import { authErrorPath, authNoticePath } from "@/i18n/auth-notices";
import { recordAdminAction } from "@/server/audit";
import { loadBookingContactSettings, notificationOrFilter } from "@/server/dashboard-data";
import { quoteAdminSlot, quoteClientSlot } from "@/server/booking-pricing";
import { getShopBarberEmail, getShopBarberId } from "@/server/shop-barber";
import { enforceRateLimit } from "@/server/rate-limit";
import { createAdminNotification, createNotification, createNotifications } from "@/server/notifications";
import type { ActionResult } from "@/domain/types";
import { getDict } from "@/i18n/server";

const emailSchema = z.email();
// Supabase (bcrypt) silently truncates passwords beyond 72 bytes; cap there so
// the password the user thinks they set is the one that is stored.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

const oauthProviderSchema = z.enum(["google", "apple"]);
const shopDateSchema = z.iso.date();
const shopTimeSchema = z.iso.time({ precision: -1 });

const consentSchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  version: z.number().int(),
  timestamp: z.string().max(40).optional(),
});

// New flow: the client picks an exact date + time for the chosen service.
const createRequestSchema = z.object({
  serviceId: z.uuid(),
  date: shopDateSchema,
  time: shopTimeSchema,
  note: z.string().max(1000).optional(),
});

const proposeSchema = z.object({
  requestId: z.uuid(),
  date: shopDateSchema,
  time: shopTimeSchema,
  note: z.string().max(1000).optional(),
});

const adminBookingSchema = z
  .object({
    clientId: z.uuid().optional(),
    customerName: z.string().trim().min(1).max(120).optional(),
    serviceId: z.uuid(),
    date: shopDateSchema,
    time: shopTimeSchema,
    priceCents: z.number().int().min(0).max(1_000_000).multipleOf(100),
    note: z.string().max(1000).optional(),
    // The barber confirmed booking into closed hours or blocked time.
    allowUnavailable: z.boolean().optional(),
  })
  // Exactly one of clientId / customerName: an existing client or a walk-in.
  // The sentinel message is mapped to a localized string in the action.
  .refine((value) => Boolean(value.clientId) !== Boolean(value.customerName), {
    message: "client-or-walkin",
  });

const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  date: shopDateSchema,
  time: shopTimeSchema,
  note: z.string().max(1000).optional(),
});

const cancelAppointmentSchema = z.object({
  appointmentId: z.uuid(),
  note: z.string().max(1000).optional(),
});

const uuidSchema = z.uuid();
const appointmentOutcomeSchema = z.enum(["completed", "no_show"]);
const toggleServiceSchema = z.object({ serviceId: z.uuid(), active: z.boolean() });
const clientRescheduleSchema = z.object({
  appointmentId: z.uuid(),
    date: shopDateSchema,
    time: shopTimeSchema,
});
const declineRequestSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
});

const fullNameSchema = z.string().trim().min(2).max(120);
const profileSchema = z.object({
  fullName: fullNameSchema,
  phone: z.string().trim().min(1).max(40),
});

const serviceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(600),
  priceCents: z.number().int().min(0).max(1_000_000).multipleOf(100),
  sundayPriceCents: z.number().int().min(0).max(1_000_000).multipleOf(100),
  imageUrl: z.string().max(500).optional(),
});

const pricingSettingsSchema = z.object({
  gapSurchargePercent: z.number().int().min(0).max(500),
  vipSurchargePercent: z.number().int().min(0).max(500),
});

const bookingContactSchema = z.object({
  address: z.string().trim().min(5).max(240),
  phone: z.string().trim().min(7).max(40),
});

const blockDateSchema = z.object({
  start: shopDateSchema,
  end: shopDateSchema,
  // Required, a few words: shown on the admin calendar and the blocked list.
  reason: z.string().trim().min(BLOCK_REASON_MIN_LENGTH).max(BLOCK_REASON_MAX_LENGTH),
  // Optional time slice on the start date (e.g. a lunch break or a 2–4pm gap).
  // When both are present, only that window on `start` is blocked, not full days.
  startTime: shopTimeSchema.optional(),
  endTime: shopTimeSchema.optional(),
});

const businessHoursSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    opensAt: shopTimeSchema,
    closesAt: shopTimeSchema,
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

// Whether a phone number is already used by some profile. `phone_taken` is a
// SECURITY DEFINER function executable by the service role only (migration
// 0032): exposing it to anon made it a phone-number enumeration oracle. The
// unique index on profiles.phone is the real backstop; this just lets us show a
// friendly message before attempting the write.
async function isPhoneTaken(phone: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient().rpc("phone_taken", {
    p_phone: phone.trim(),
  });
  if (error) {
    await reportError("phone-taken", error);
    return false; // fail open — the DB unique index still protects us
  }
  return data === true;
}

// Postgres unique-violation surfaced through the phone index (race backstop).
function isDuplicatePhoneError(message: string | undefined): boolean {
  return Boolean(message && message.includes("profiles_phone_unique"));
}

function addMinutes(iso: string, minutes: number) {
  // Epoch arithmetic: setMinutes() works in the process time zone and drifts
  // by an hour across a DST change on non-UTC hosts.
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function startsAt(date: string, time: string) {
  return zonedDateTimeToUtcIso(date, time);
}

// "HH:MM" in the shop time zone from an ISO timestamp.
function timeFromIso(iso: string) {
  return timeInShopTimeZone(iso);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

// Supabase's signUp deliberately returns a success-shaped response for an email
// that is already registered (to avoid account enumeration): the user object
// comes back with an empty identities array and no email is sent. Left alone,
// the person would wait for a confirmation that never arrives.
function isExistingUserSignUp(user: { identities?: unknown[] | null } | null | undefined) {
  return Boolean(user) && Array.isArray(user?.identities) && user.identities.length === 0;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getDict();
  const email = normalizeEmail(formString(formData, "email"));
  const password = formString(formData, "password");
  const values = { email };

  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (!emailSchema.safeParse(email).success) {
    fieldErrors.email = t.auth.errors.emailInvalid;
  }
  if (password.length < PASSWORD_MIN) {
    fieldErrors.password = t.auth.errors.passwordTooShort;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  // Two budgets: the IP is the primary brake against password spraying, the
  // per-email budget is deliberately generous so a stranger cannot lock a
  // victim out of their own account by hammering their address.
  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit("auth:sign-in-ip", { limit: 30, windowSeconds: 15 * 60 }),
    enforceRateLimit("auth:sign-in", { identity: email, limit: 40, windowSeconds: 15 * 60 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: t.feedback.tooManyAttempts, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const kind = authErrorKind(error);
    // The account exists but the confirmation link was never opened. Say so
    // and let the form offer to resend it instead of blaming the password.
    if (kind === "email_not_confirmed") {
      return { error: t.auth.errors.emailNotConfirmed, unconfirmedEmail: email, values };
    }
    if (kind === "rate_limited") {
      return { error: t.feedback.tooManyAttempts, values };
    }
    if (kind === "banned") {
      return { error: t.auth.errors.accountBanned, values };
    }
    if (kind === "invalid_credentials" || (kind === "unknown" && error.status === 400)) {
      return { error: t.feedback.checkEmailPassword, values };
    }
    await reportError("auth-sign-in", error, { code: error.code, status: error.status });
    return { error: t.common.somethingWentWrong, values };
  }

  redirect("/dashboard");
}

// Re-sends the sign-up confirmation email. Always ends on the same neutral
// notice so the endpoint cannot be used to probe which emails are registered.
export async function resendConfirmationAction(formData: FormData) {
  const email = normalizeEmail(formString(formData, "email"));
  const target = authNoticePath("/login", "confirm_resent", email);

  if (!emailSchema.safeParse(email).success) {
    redirect(target);
  }

  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit("auth:resend-confirmation-ip", { limit: 10, windowSeconds: 15 * 60 }),
    enforceRateLimit("auth:resend-confirmation", { identity: email, limit: 5, windowSeconds: 60 * 60 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    redirect(`${authErrorPath("/login", "too_many_attempts")}&email=${encodeURIComponent(email)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
  });
  if (error) {
    await reportError("auth-resend-confirmation", error, { code: error.code });
  }

  redirect(target);
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = normalizeEmail(formString(formData, "email"));

  // Always end on the same neutral notice (don't leak which emails are registered).
  const sentUrl = authNoticePath("/reset-password", "reset_sent");
  if (!emailSchema.safeParse(email).success) {
    redirect(sentUrl);
  }

  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit("auth:reset-request-ip", { limit: 10, windowSeconds: 15 * 60 }),
    enforceRateLimit("auth:reset-request", { identity: email, limit: 5, windowSeconds: 60 * 60 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    redirect(`${authErrorPath("/reset-password", "too_many_attempts")}&email=${encodeURIComponent(email)}`);
  }

  const supabase = await createClient();
  // The recovery link lands on /auth/callback, which exchanges the code and
  // forwards recovery sessions to /auth/update-password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?type=recovery`,
  });
  if (error) {
    await reportError("auth-reset-request", error, { code: error.code });
  }

  redirect(sentUrl);
}

export async function updatePasswordAction(formData: FormData) {
  const password = passwordSchema.safeParse(formString(formData, "password"));

  if (!password.success) {
    redirect(authErrorPath("/auth/update-password", "password_too_short"));
  }

  // The recovery session was established by /auth/callback or /auth/confirm;
  // updateUser applies to it. Without one the link expired or was reused.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    redirect(authErrorPath("/reset-password", "reset_link_invalid"));
  }

  const { error } = await supabase.auth.updateUser({ password: password.data });

  if (error) {
    const kind = authErrorKind(error);
    if (kind === "same_password") {
      redirect(authErrorPath("/auth/update-password", "same_password"));
    }
    if (kind === "weak_password") {
      redirect(authErrorPath("/auth/update-password", "password_weak"));
    }
    if (kind === "rate_limited") {
      redirect(authErrorPath("/auth/update-password", "too_many_attempts"));
    }
    if (error.status === 401 || error.status === 403) {
      redirect(authErrorPath("/reset-password", "reset_link_invalid"));
    }
    await reportError("auth-update-password", error, { code: error.code });
    redirect(authErrorPath("/auth/update-password", "generic"));
  }

  // The recovery session is single-purpose: end it and ask for a fresh sign-in
  // with the new password so every device starts from a known state.
  await supabase.auth.signOut();
  redirect(authNoticePath("/login", "password_updated"));
}

export async function signInWithOAuthAction(formData: FormData) {
  const provider = oauthProviderSchema.safeParse(formString(formData, "provider"));
  const intent = parseOAuthIntent(formString(formData, "intent"));
  const startPath = oauthStartPath(intent);

  if (!provider.success) {
    redirect(authErrorPath(startPath, "oauth_failed"));
  }

  // The same Google flow signs in and registers. Remember which page the
  // person started from so /auth/callback can say that an unknown account has
  // just started a registration. A short-lived cookie rather than a query
  // parameter keeps redirectTo identical to the URL allow-listed in Supabase.
  (await cookies()).set(OAUTH_INTENT_COOKIE, intent, {
    httpOnly: true,
    secure: getSiteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/auth",
    maxAge: 10 * 60,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error || !data.url) {
    if (error) {
      await reportError("auth-oauth", error, { provider: provider.data });
    }
    redirect(authErrorPath(startPath, "oauth_failed"));
  }

  // Hand off to the provider's consent screen.
  redirect(data.url);
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getDict();
  const fullName = formString(formData, "fullName").trim();
  const email = normalizeEmail(formString(formData, "email"));
  const phoneInput = formString(formData, "phone");
  const password = formString(formData, "password");
  const values = { fullName, email, phone: phoneInput };

  // Validate every field and report all problems at once — a redirect with a
  // single generic message made people guess which input was wrong.
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (!fullNameSchema.safeParse(fullName).success) {
    fieldErrors.fullName = t.auth.errors.nameTooShort;
  }
  if (!emailSchema.safeParse(email).success) {
    fieldErrors.email = t.auth.errors.emailInvalid;
  }
  const phone = parsePhone(phoneInput);
  if (!phone) {
    fieldErrors.phone = t.auth.errors.phoneInvalid;
  }
  if (!passwordSchema.safeParse(password).success) {
    fieldErrors.password = t.auth.errors.passwordTooShort;
  }
  if (Object.keys(fieldErrors).length > 0 || !phone) {
    return { fieldErrors, values };
  }

  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit("auth:register-ip", { limit: 10, windowSeconds: 60 * 60 }),
    enforceRateLimit("auth:register", { identity: email, limit: 5, windowSeconds: 60 * 60 }),
  ]);
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: t.feedback.tooManyAttempts, values };
  }

  const supabase = await createClient();

  // Reject a phone number that's already in use before creating the auth user.
  if (await isPhoneTaken(phone)) {
    return { fieldErrors: { phone: t.feedback.phoneTaken }, values };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error) {
    // Nothing is saved when signUp fails (the auth user, its profile and the
    // confirmation email are one transaction), so every message invites a retry
    // or a correction. A phone claimed concurrently is not an error here: the
    // sign-up trigger creates the profile without it (migration 0053) and the
    // account is asked for another number on /complete-profile.
    switch (authErrorKind(error)) {
      case "email_taken":
        return { fieldErrors: { email: t.auth.errors.emailTaken }, values };
      case "email_invalid":
        return { fieldErrors: { email: t.auth.errors.emailInvalid }, values };
      case "weak_password":
        return { fieldErrors: { password: t.auth.errors.passwordWeak }, values };
      case "rate_limited":
        return { error: t.feedback.tooManyAttempts, values };
      case "signup_disabled":
        return { error: t.auth.errors.signupDisabled, values };
      case "email_delivery":
        await reportError("auth-register-email", error, { code: error.code, status: error.status });
        return { error: t.auth.errors.emailDeliveryFailed, values };
      default:
        await reportError("auth-register", error, { code: error.code, status: error.status });
        return { error: t.common.somethingWentWrong, values };
    }
  }

  if (isExistingUserSignUp(data.user)) {
    return { fieldErrors: { email: t.auth.errors.emailTaken }, values };
  }

  // Email confirmation disabled in Supabase: the user is signed in right away.
  if (data.session) {
    redirect("/dashboard");
  }

  redirect(authNoticePath("/login", "confirm_sent", email));
}

// Calendar feed links are bearer secrets embedded in calendar apps. Rotating
// invalidates every previously shared URL for the caller (admin or client).
export async function rotateCalendarTokenAction(): Promise<ActionResult> {
  const profile = await requireProfile();
  const t = await getDict();

  const limit = await enforceRateLimit("calendar:rotate-token", {
    identity: profile.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = profile.role === "admin"
    ? await getSupabaseAdminClient()
      .from("profiles")
      .update({ calendar_token: randomUUID() })
      .eq("id", await getShopBarberId())
    : await (await createClient()).rpc("rotate_my_calendar_token");
  if (error) {
    await reportError("calendar-rotate-token", error, { userId: profile.id });
    return { ok: false, error: t.common.somethingWentWrong };
  }

  if (profile.role === "admin") {
    await recordAdminAction("calendar.rotate_token", { targetType: "profile", targetId: await getShopBarberId() });
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/client/reservations");
  return { ok: true, message: t.admin.feedLinkRotated };
}

export async function signOutAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // A browser push endpoint belongs to the device, not the session. The
    // server cannot identify this browser's endpoint during a form action, so
    // revoke this account's endpoints before signing out. Other signed-in
    // devices reconcile their existing opt-in when their shell wakes.
    const { error } = await getSupabaseAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);
    if (error) await reportError("auth-sign-out-push", error, { userId: user.id });
  }
  await supabase.auth.signOut();
  redirect("/login");
}

// Persist a signed-in user's cookie-consent choice as an auditable, append-only
// record (proof of consent). The runtime source of truth is the client-side
// `cookie_consent` cookie; this only mirrors the decision to the DB and is a
// no-op for logged-out visitors. It never blocks the UI — failures are silent.
export async function recordConsentAction(input: unknown): Promise<ActionResult> {
  const t = await getDict();
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t.common.somethingWentWrong };
  }

  // Logged-out visitors are fine — their choice lives only in the cookie.
  const { configured, profile } = await getCurrentProfile();
  if (!configured || !profile) {
    return { ok: true };
  }

  const limit = await enforceRateLimit("privacy:record-consent", {
    identity: profile.id,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
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
    await reportError("record-consent", error, { userId: profile.id });
    return { ok: false, error: t.common.somethingWentWrong };
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
    .select("name, duration_minutes, price_cents, sunday_price_cents")
    .eq("id", parsed.data.serviceId)
    .single();

  if (serviceError) {
    await reportError("booking-create", serviceError, { phase: "load-service" });
    return { ok: false, error: t.common.somethingWentWrong };
  }
  if (!service) {
    return { ok: false, error: t.feedback.serviceNotFound };
  }

  const start = startsAt(parsed.data.date, parsed.data.time);
  const end = addMinutes(start, service.duration_minutes);

  // Must be in the future, inside the client booking window, and fit inside working hours.
  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  if (!isStartInClientBookingWindow(start)) {
    return { ok: false, error: t.feedback.chooseWithinTwoWeeks };
  }
  const [guarded, quote] = await Promise.all([
    guardSlot(supabase, {
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
      start,
      end,
    }),
    quoteClientSlot(supabase, {
      date: parsed.data.date,
      time: parsed.data.time,
      durationMinutes: service.duration_minutes,
      basePriceCents: service.price_cents,
      sundayPriceCents: service.sunday_price_cents,
    }),
  ]);
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotNoLongerFree;
    return { ok: false, error };
  }

  if (!quote.ok) {
    return { ok: false, error: t.feedback.pickGeneratedSlot };
  }

  // Inserted with the service role: RLS no longer lets clients write this
  // table directly, so the quoted price above is the only price that can land.
  const { error: requestError } = await getSupabaseAdminClient().from("booking_requests").insert({
    client_id: profile.id,
    service_id: parsed.data.serviceId,
    note: parsed.data.note ?? null,
    status: "pending",
    requested_start: start,
    requested_end: end,
    price_cents: quote.priceCents,
    surcharge: quote.surcharge,
  });

  if (requestError) {
    await reportError("booking-create", requestError, { phase: "insert-request" });
    return { ok: false, error: t.common.somethingWentWrong };
  }

  const barberEmail = await getShopBarberEmail();
  const deliveries: Promise<unknown>[] = [
    createAdminNotification({
      channel: "email",
      recipient: barberEmail,
      subject: `${profile.full_name} žiada termín ${parsed.data.date} o ${parsed.data.time}`,
      push: adminNewRequestPush({
        client: profile.full_name,
        service: service.name,
        date: parsed.data.date,
        time: parsed.data.time,
      }),
      pushUrl: "/admin/requests",
    }),
    sendEmail({
      to: barberEmail,
      subject: `${profile.full_name} žiada termín ${parsed.data.date} o ${parsed.data.time}`,
      react: BookingRequestEmail({
        clientName: profile.full_name,
        service: service.name,
        date: parsed.data.date,
        time: parsed.data.time,
        note: parsed.data.note,
      }),
    }),
  ];

  // Acknowledge to the client too (they used to hear nothing until confirmation).
  if (profile.email) {
    const clientSubject = "Vašu rezerváciu sme prijali";
    deliveries.push(createNotification(supabase, {
      user_id: profile.id,
      channel: "email",
      recipient: profile.email,
      subject: clientSubject,
      body: `Žiadosť o ${service.name} na ${parsed.data.date} o ${parsed.data.time} sme prijali. Termín bude ešte potvrdený.`,
      push: clientRequestReceivedPush({ service: service.name, date: parsed.data.date, time: parsed.data.time }),
      pushUrl: "/client/reservations",
    }));
    deliveries.push(sendEmail({
      to: profile.email,
      subject: clientSubject,
      react: BookingReceivedEmail({
        clientName: profile.full_name,
        service: service.name,
        date: parsed.data.date,
        time: parsed.data.time,
      }),
    }));
  }
  await Promise.all(deliveries);

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
  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }
  const supabase = await createClient();

  // Don't approve an incomplete registration: the email must be verified and a
  // phone number on file (Google sign-ups add theirs on /complete-profile).
  const { data: candidate } = await supabase
    .from("profiles")
    .select("email_confirmed_at, phone, role")
    .eq("id", clientId)
    .single();

  if (!candidate || candidate.role !== "client") {
    return { ok: false, error: t.feedback.chooseValidClient };
  }
  if (!isReadyForApproval({ emailConfirmed: Boolean(candidate.email_confirmed_at), phone: candidate.phone })) {
    return {
      ok: false,
      error: candidate.email_confirmed_at ? t.feedback.phoneMissing : t.feedback.emailNotConfirmed,
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", clientId)
    .eq("role", "client")
    .select("id, email, full_name")
    .single();

  if (error || !profile) {
    if (error) {
      await reportError("client-approve", error, { clientId });
    }
    return { ok: false, error: t.feedback.couldNotApprove };
  }

  await createNotification(supabase, {
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Váš účet Samuelsson Cuts bol schválený",
    body: `Dobrý deň, ${profile.full_name}, váš účet je schválený. Môžete si rezervovať termín.`,
    push: accountApprovedPush(),
    pushUrl: "/client",
  });
  await sendEmail({
    to: profile.email,
    subject: "Váš účet Samuelsson Cuts bol schválený",
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
  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }
  const supabase = await createClient();

  // Only a pending registration can be rejected; an approved client with
  // confirmed appointments must go through block (which cancels them).
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ approval_status: "rejected" })
    .eq("id", clientId)
    .eq("role", "client")
    .eq("approval_status", "pending")
    .select("id, email, full_name")
    .maybeSingle();

  if (error || !profile) {
    if (error) {
      await reportError("client-reject", error, { clientId });
    }
    return { ok: false, error: t.feedback.chooseValidClient };
  }

  await createNotification(supabase, {
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Informácia k účtu Samuelsson Cuts",
    body: `Dobrý deň, ${profile.full_name}, váš účet momentálne nevieme schváliť.`,
    push: accountRejectedPush(),
    pushUrl: "/client/notifications",
  });
  await sendEmail({
    to: profile.email,
    subject: "Informácia k účtu Samuelsson Cuts",
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
  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ approval_status: "blocked" })
    .eq("id", clientId)
    .eq("role", "client")
    .select("id, email, full_name")
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      error: profileError?.message ?? t.feedback.chooseValidClient,
    };
  }

  const { data: openRequests } = await supabase
    .from("booking_requests")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["pending", "proposed"]);
  const openRequestIds = (openRequests ?? []).map((request) => request.id);
  if (openRequestIds.length > 0) {
    await supabase
      .from("appointment_proposals")
      .update({ status: "expired" })
      .in("request_id", openRequestIds)
      .eq("status", "sent");
  }

  await supabase
    .from("booking_requests")
    .update({ status: "cancelled" })
    .eq("client_id", clientId)
    .in("status", ["pending", "proposed"]);

  // Preserve appointment history: soft-cancel each future booking through the
  // same transactional lifecycle RPC used by the calendar action.
  const now = new Date().toISOString();
  const { data: futureAppointments } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "confirmed")
    .gt("starts_at", now);
  for (const appointment of futureAppointments ?? []) {
    await supabase.rpc("admin_cancel_appointment", {
      p_appointment_id: appointment.id,
      p_allow_past: false,
    });
  }

  await createNotification(supabase, {
    user_id: profile.id,
    channel: "email",
    recipient: profile.email,
    subject: "Prístup k účtu Samuelsson Cuts bol zrušený",
    push: accountBlockedPush(),
    pushUrl: "/client/notifications",
  });
  await sendEmail({
    to: profile.email,
    subject: "Prístup k účtu Samuelsson Cuts bol zrušený",
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
  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }
  const supabase = await createClient();

  // Unblock restores a blocked account only; it must not approve a pending
  // registration and bypass the readiness gate in approveClientAction.
  const { data: restored, error } = await supabase
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", clientId)
    .eq("role", "client")
    .eq("approval_status", "blocked")
    .select("id")
    .maybeSingle();

  if (error || !restored) {
    if (error) {
      await reportError("client-unblock", error, { clientId });
    }
    return { ok: false, error: t.feedback.chooseValidClient };
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
  if (!uuidSchema.safeParse(clientId).success) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", clientId)
    .maybeSingle();
  if (!target || target.role !== "client") {
    return { ok: false, error: t.feedback.chooseValidClient };
  }

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
    await deleteClientAccount(clientId);
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

  const limit = await enforceRateLimit("booking:propose-appointment", {
    identity: admin.id,
    limit: 60,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const supabase = await createClient();
  const start = startsAt(parsed.data.date, parsed.data.time);

  if (!isStartInFuture(start)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  if (!isStartInClientBookingWindow(start)) {
    return { ok: false, error: t.feedback.chooseWithinTwoWeeks };
  }

  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .select("id, client_id, service_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? t.feedback.requestNotFound };
  }

  if (request.status !== "pending" && request.status !== "proposed") {
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

  const guarded = await guardSlot(supabase, {
    barberId: await getShopBarberId(),
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes: service.duration_minutes,
    start,
    end,
  });
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotTaken;
    return { ok: false, error };
  }

  const { data: proposalId, error: proposalError } = await getSupabaseAdminClient()
    .rpc("admin_replace_proposal", {
      p_request_id: parsed.data.requestId,
      p_start: start,
      p_note: parsed.data.note ?? null,
    });

  if (proposalError || !proposalId) {
    return { ok: false, error: proposalError?.message ?? t.feedback.unableSendProposal };
  }

  await createNotification(supabase, {
    user_id: request.client_id,
    channel: "email",
    recipient: clientProfile?.email ?? "client",
    subject: `Navrhnutý termín ${parsed.data.date} o ${parsed.data.time}`,
    body: parsed.data.note ?? null,
    push: clientProposedPush({ service: service.name, date: parsed.data.date, time: parsed.data.time }),
    pushUrl: "/client/reservations",
  });
  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: `Navrhnutý termín ${parsed.data.date} o ${parsed.data.time}`,
      react: AppointmentProposedEmail({
        clientName: clientProfile.full_name ?? "klient",
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

export async function declineRequestAdminAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = declineRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t.feedback.unableDeclineRequest };
  }

  const limit = await enforceRateLimit("booking:decline-request", {
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
    .select("id, client_id, status")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (
    requestError ||
    !request ||
    (request.status !== "pending" && request.status !== "proposed")
  ) {
    return { ok: false, error: t.feedback.unableDeclineRequest };
  }

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", request.client_id)
    .maybeSingle();

  const { error: declineError } = await supabase.rpc("admin_decline_booking_request", {
    p_request_id: request.id,
    p_reason: parsed.data.reason || null,
  });
  if (declineError) {
    return { ok: false, error: t.feedback.unableDeclineRequest };
  }

  if (clientProfile?.email) {
    await createNotification(supabase, {
      user_id: request.client_id,
      channel: "email",
      recipient: clientProfile.email,
      subject: t.feedback.requestDeclinedSubject,
      body: parsed.data.reason || t.feedback.requestDeclinedBody,
      push: clientRequestDeclinedPush(),
      pushUrl: "/client/reservations",
    });
    await sendEmail({
      to: clientProfile.email,
      subject: t.feedback.requestDeclinedSubject,
      react: BookingRequestDeclinedEmail({
        clientName: clientProfile.full_name ?? "klient",
        reason: parsed.data.reason,
      }),
    });
  }

  await recordAdminAction("request.decline", {
    targetType: "booking_request",
    targetId: request.id,
    detail: parsed.data.reason ? { reason: parsed.data.reason } : undefined,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.requestDeclined };
}

// Barber confirms a client's exact-slot request as-is → a confirmed appointment.
// Other pending requests for the SAME slot are auto-declined and those clients
// notified (the slot is now taken).
export async function confirmRequestAction(requestId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const t = await getDict();
  if (!uuidSchema.safeParse(requestId).success) {
    return { ok: false, error: t.feedback.requestNotFound };
  }
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

  if (requestedDuration <= 0) {
    return { ok: false, error: t.feedback.slotOutsideHours };
  }
  const guarded = await guardSlot(supabase, {
    barberId: await getShopBarberId(),
    date: requestedDate,
    time: requestedTime,
    durationMinutes: requestedDuration,
    start: request.requested_start,
    end: request.requested_end,
  });
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotNoLongerFree;
    return { ok: false, error };
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

  // Resolve the calendar location before the booking mutation, so a failed
  // settings read cannot report failure after an appointment was confirmed.
  let bookingAddress: string;
  try {
    bookingAddress = (await loadBookingContactSettings()).address;
  } catch {
    return { ok: false, error: t.common.somethingWentWrong };
  }
  const { data: appointmentId, error: confirmError } = await supabase.rpc("confirm_booking_request", {
    p_request_id: request.id,
    p_barber_id: await getShopBarberId(),
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

    await createNotifications(
      supabase,
      siblings.map((s) => ({
        user_id: s.client_id,
        channel: "email" as const,
        recipient: siblingProfiles?.find((p) => p.id === s.client_id)?.email ?? "client",
        subject: "Požadovaný termín už nie je dostupný",
        push: clientSlotTakenPush(),
        pushUrl: "/client/book",
      })),
    );

    // Send slot-taken emails to each displaced sibling.
    for (const sibling of siblingProfiles ?? []) {
      if (sibling.email) {
        await sendEmail({
          to: sibling.email,
          subject: "Požadovaný termín už nie je dostupný",
          react: SlotTakenEmail({ clientName: sibling.full_name ?? "klient" }),
        });
      }
    }
  }

  await createNotification(supabase, {
    user_id: request.client_id,
    channel: "email",
    recipient: confirmedClient?.email ?? "client",
    subject: "Váš termín je potvrdený",
    push: clientConfirmedPush({ service: confirmedService?.name, date: requestedDate, time: requestedTime }),
    pushUrl: "/client/reservations",
  });
  if (confirmedClient?.email) {
    await sendEmail({
      to: confirmedClient.email,
      subject: "Váš termín je potvrdený",
      react: AppointmentConfirmedEmail({
        clientName: confirmedClient.full_name ?? "klient",
        service: confirmedService?.name ?? "",
        date: requestedDate,
        time: requestedTime,
        appointmentId,
        startIso: request.requested_start,
        endIso: request.requested_end,
        location: bookingAddress,
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

  const limit = await enforceRateLimit("booking:admin-reschedule", {
    identity: admin.id,
    limit: 60,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, request_id, client_id, service_id, status, ends_at, outcome")
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
  if (appointment.status !== "confirmed") {
    return { ok: false, error: t.feedback.appointmentNotFound };
  }
  if (appointment.outcome || new Date(appointment.ends_at).getTime() <= Date.now()) {
    return { ok: false, error: t.feedback.appointmentAlreadyEnded };
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

  const guarded = await guardSlot(supabase, {
    barberId: await getShopBarberId(),
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes: service.duration_minutes,
    start,
    end,
    excludeAppointmentId: appointment.id,
  });
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotTaken;
    return { ok: false, error };
  }

  const [{ data: clientProfile }, { data: rescheduleService }] = await Promise.all([
    appointment.client_id
      ? supabase.from("profiles").select("email, full_name").eq("id", appointment.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("services").select("name").eq("id", appointment.service_id).single(),
  ]);

  const { error: rescheduleError } = await supabase.rpc(
    "admin_reschedule_appointment_to_proposal",
    {
      p_appointment_id: appointment.id,
      p_new_start: start,
      p_new_end: end,
      p_note: parsed.data.note ?? null,
    },
  );
  if (rescheduleError) {
    return { ok: false, error: t.feedback.unableSendNewTime };
  }

  await createNotification(supabase, {
    user_id: appointment.client_id,
    channel: "email",
    recipient: clientProfile?.email ?? "client",
    subject: `Termín bol presunutý: ${parsed.data.date} o ${parsed.data.time}`,
    body: parsed.data.note ?? null,
    push: clientRescheduledPush({ service: rescheduleService?.name, date: parsed.data.date, time: parsed.data.time }),
    pushUrl: "/client/reservations",
  });
  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: `Termín bol presunutý: ${parsed.data.date} o ${parsed.data.time}`,
      react: AppointmentRescheduledEmail({
        clientName: clientProfile.full_name ?? "klient",
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
  const admin = await requireAdmin();
  const t = await getDict();
  const parsed = cancelAppointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.couldNotCancelAppointment };
  }

  const limit = await enforceRateLimit("booking:admin-cancel", {
    identity: admin.id,
    limit: 60,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
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

  const { error: cancelError } = await supabase.rpc("admin_cancel_appointment", {
    p_appointment_id: appointment.id,
    p_allow_past: false,
  });
  if (cancelError) {
    return { ok: false, error: t.feedback.couldNotCancelAppointment };
  }

  // Walk-ins (no client_id) have nobody to notify.
  if (appointment.client_id && clientProfile?.email) {
    const cancelDate = dateInShopTimeZone(appointment.starts_at);
    const cancelTime = timeFromIso(appointment.starts_at);
    await createNotification(supabase, {
      user_id: appointment.client_id,
      channel: "email",
      recipient: clientProfile.email,
      subject: "Váš termín bol zrušený",
      body: parsed.data.note ?? null,
      push: clientCancelledPush({ service: cancelService?.name, date: cancelDate, time: cancelTime }),
      pushUrl: "/client/reservations",
    });
    await sendEmail({
      to: clientProfile.email,
      subject: "Váš termín bol zrušený",
      react: AppointmentCancelledEmail({
        clientName: clientProfile.full_name ?? "klient",
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

  const limit = await enforceRateLimit("booking:admin-create", {
    identity: admin.id,
    limit: 120,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) return { ok: false, error: limit.error };

  const clientProfileResult = parsed.data.clientId
    ? await supabase
      .from("profiles")
      .select("id, role, approval_status, email, full_name")
      .eq("id", parsed.data.clientId)
      .maybeSingle()
    : null;
  const clientProfile = clientProfileResult?.data;

  if (parsed.data.clientId &&
    (!clientProfile || clientProfile.role !== "client" || clientProfile.approval_status !== "approved")) {
    return { ok: false, error: t.feedback.chooseValidClient };
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, duration_minutes, price_cents, sunday_price_cents, active")
    .eq("id", parsed.data.serviceId)
    .single();

  if (serviceError || !service || !service.active) {
    return { ok: false, error: serviceError?.message ?? t.feedback.serviceNotFound };
  }

  const end = addMinutes(start, service.duration_minutes);

  const allowUnavailable = parsed.data.allowUnavailable === true;
  const guarded = await guardSlot(supabase, {
    barberId: await getShopBarberId(),
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes: service.duration_minutes,
    start,
    end,
    allowUnavailable,
  });
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotTaken;
    return { ok: false, error };
  }

  const quote = await quoteAdminSlot(supabase, {
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes: service.duration_minutes,
    basePriceCents: service.price_cents,
    sundayPriceCents: service.sunday_price_cents,
  });
  if (!quote.ok) {
    return { ok: false, error: t.feedback.slotTaken };
  }

  let bookingAddress: string;
  try {
    bookingAddress = (await loadBookingContactSettings()).address;
  } catch {
    return { ok: false, error: t.common.somethingWentWrong };
  }
  const { data: appointmentId, error: insertError } = await getSupabaseAdminClient().rpc("admin_create_booking_priced", {
    p_client_id: parsed.data.clientId ?? null,
    p_customer_name: parsed.data.customerName ?? null,
    p_service_id: parsed.data.serviceId,
    p_start: start,
    p_price_cents: parsed.data.priceCents,
    p_surcharge: quote.priceCents === parsed.data.priceCents && quote.surcharge,
    p_note: parsed.data.note ?? null,
    p_allow_unavailable: allowUnavailable,
  });

  if (insertError || !appointmentId) {
    if (insertError) await reportError("admin-create-booking", insertError);
    return { ok: false, error: t.feedback.slotTaken };
  }

  if (clientProfile) {
    await createNotification(supabase, {
      user_id: clientProfile.id,
      channel: "email",
      recipient: clientProfile.email ?? "client",
      subject: "Váš termín je potvrdený",
      push: clientConfirmedPush({ service: service.name, date: parsed.data.date, time: parsed.data.time }),
      pushUrl: "/client/reservations",
    });
    if (clientProfile.email) {
      await sendEmail({
        to: clientProfile.email,
        subject: "Váš termín je potvrdený",
        react: AppointmentConfirmedEmail({
          clientName: clientProfile.full_name ?? "klient",
          service: service.name,
          date: parsed.data.date,
          time: parsed.data.time,
          appointmentId,
          startIso: start,
          endIso: end,
          location: bookingAddress,
        }),
      });
    }
  }

  await recordAdminAction("appointment.create", {
    targetType: "appointment",
    targetId: appointmentId,
    detail: {
      date: parsed.data.date,
      time: parsed.data.time,
      walkIn: !parsed.data.clientId,
      priceCents: parsed.data.priceCents,
      customPrice: parsed.data.priceCents !== quote.priceCents,
      allowUnavailable,
    },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.bookingAdded };
}

export async function respondToProposalAction(
  proposalId: string,
  accepted: boolean,
): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const response = z.object({ proposalId: z.uuid(), accepted: z.boolean() }).safeParse({
    proposalId,
    accepted,
  });
  if (!response.success) {
    return { ok: false, error: t.feedback.cannotRespond };
  }
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
    if (error) {
      await reportError("proposal-response", error, { phase: "load-proposal" });
    }
    return { ok: false, error: t.feedback.proposalNotFound };
  }

  if (proposal.status !== "sent") {
    return { ok: false, error: t.feedback.proposalClosed };
  }
  if (!isStartInFuture(proposal.starts_at)) {
    return { ok: false, error: t.feedback.chooseFutureTime };
  }
  // The barber chose this time, so the two-week client window only guards the
  // accept path; a client must always be able to decline.
  if (response.data.accepted && !isStartInClientBookingWindow(proposal.starts_at)) {
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

    if (proposalDuration <= 0) {
      return { ok: false, error: t.feedback.slotOutsideHours };
    }
    const guarded = await guardSlot(supabase, {
      barberId: proposal.barber_id,
      date: proposalDate,
      time: proposalTime,
      durationMinutes: proposalDuration,
      start: proposal.starts_at,
      end: proposal.ends_at,
    });
    if (!guarded.ok) {
      const error = guarded.reason === "outside-hours"
        ? t.feedback.slotOutsideHours
        : guarded.reason === "blocked"
          ? t.feedback.slotUnavailable
          : t.feedback.timeJustTaken;
      return { ok: false, error };
    }

  }

  const { error: responseError } = await supabase.rpc("respond_to_appointment_proposal", {
    p_proposal_id: proposalId,
    p_client_id: profile.id,
    p_accepted: accepted,
  });

  if (responseError) {
    await reportError("proposal-response", responseError, { proposalId, accepted });
    return { ok: false, error: accepted ? t.feedback.timeJustTaken : t.feedback.cannotRespond };
  }

  const barberEmailForResponse = await getShopBarberEmail();
  const respondDate = dateInShopTimeZone(proposal.starts_at);
  const respondTime = timeFromIso(proposal.starts_at);
  const respondSubject = accepted
    ? `${profile.full_name} potvrdil termín`
    : `${profile.full_name} odmietol navrhnutý termín`;

  await createAdminNotification({
    channel: "email",
    recipient: barberEmailForResponse,
    subject: respondSubject,
    push: adminProposalResponsePush({
      client: profile.full_name,
      service: respondService?.name,
      date: respondDate,
      time: respondTime,
      accepted,
    }),
    pushUrl: "/admin/requests",
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

  const phone = parsePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: t.auth.errors.phoneInvalid };
  }

  const supabase = await createClient();

  // phone_taken also matches the caller's own row, so only pre-check when the
  // number actually changes; the unique index remains the backstop.
  if (phone !== profile.phone && (await isPhoneTaken(phone))) {
    return { ok: false, error: t.feedback.phoneTaken };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone })
    .eq("id", profile.id);

  if (error) {
    await reportError("profile-update", error, { userId: profile.id });
    return {
      ok: false,
      error: isDuplicatePhoneError(error.message)
        ? t.feedback.phoneTaken
        : t.common.somethingWentWrong,
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
  const parsed = z.object({ phone: z.string().trim().min(1).max(40) }).safeParse(input);
  const phone = parsed.success ? parsePhone(parsed.data.phone) : null;

  if (!phone) {
    return { ok: false, error: t.auth.errors.phoneInvalid };
  }

  const supabase = await createClient();

  if (await isPhoneTaken(phone)) {
    return { ok: false, error: t.feedback.phoneTaken };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ phone })
    .eq("id", profile.id);

  if (error) {
    await reportError("profile-complete-phone", error, { userId: profile.id });
    return {
      ok: false,
      error: isDuplicatePhoneError(error.message)
        ? t.feedback.phoneTaken
        : t.common.somethingWentWrong,
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

  const limit = await enforceRateLimit("profile:upload-avatar", {
    identity: profile.id,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

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
    await reportError("avatar-upload", uploadError, { userId: profile.id, phase: "storage" });
    return { ok: false, error: t.feedback.avatarUploadFailed };
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", profile.id);

  if (updateError) {
    await reportError("avatar-upload", updateError, { userId: profile.id, phase: "profile" });
    return { ok: false, error: t.feedback.avatarUploadFailed };
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
    await reportError("avatar-remove", error, { userId: profile.id });
    return { ok: false, error: t.feedback.avatarUploadFailed };
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
  sundayPriceCents: number;
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
      sunday_price_cents: parsed.data.sundayPriceCents,
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

  updateTag("service-catalog");
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
    sundayPriceCents: number;
    imageUrl?: string;
  },
): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success || !uuidSchema.safeParse(serviceId).success) {
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
      sunday_price_cents: parsed.data.sundayPriceCents,
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

  updateTag("service-catalog");
  revalidatePath("/admin", "layout");
  return { ok: true, message: t.feedback.serviceUpdated };
}

export async function savePricingSettingsAction(input: {
  gapSurchargePercent: number;
  vipSurchargePercent: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = pricingSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.checkPricingSettings };
  }

  const { error } = await getSupabaseAdminClient()
    .from("pricing_settings")
    .upsert(
      {
        barber_id: await getShopBarberId(),
        gap_surcharge_percent: parsed.data.gapSurchargePercent,
        vip_surcharge_percent: parsed.data.vipSurchargePercent,
      },
      { onConflict: "barber_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("pricing_settings.update", {
    targetType: "pricing_settings",
    targetId: await getShopBarberId(),
    detail: parsed.data,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/client", "layout");
  return { ok: true, message: t.feedback.pricingSettingsSaved };
}

export async function saveBookingContactAction(input: BookingContact): Promise<ActionResult> {
  const profile = await requireAdmin();
  const t = await getDict();
  const parsed = bookingContactSchema.safeParse(input);
  const phone = parsed.success ? parsePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) {
    return { ok: false, error: t.feedback.checkBookingContact };
  }

  const barberId = await getShopBarberId();
  if (profile.id !== barberId) {
    return { ok: false, error: t.feedback.bookingContactBarberOnly };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booking_contact_settings").upsert({
    barber_id: barberId,
    address: parsed.data.address,
    phone,
  }, { onConflict: "barber_id" });
  if (error) return { ok: false, error: t.common.somethingWentWrong };

  await recordAdminAction("booking_contact_settings.update", {
    targetType: "booking_contact_settings",
    targetId: barberId,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/client/reservations/[id]", "page");
  return { ok: true, message: t.feedback.bookingContactSaved };
}

export async function toggleServiceActiveAction(
  serviceId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = toggleServiceSchema.safeParse({ serviceId, active });
  if (!parsed.success) {
    return { ok: false, error: t.feedback.checkServiceFields };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAdminAction("service.toggle", {
    targetType: "service",
    targetId: serviceId,
    detail: { active },
  });

  updateTag("service-catalog");
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
  const admin = await requireAdmin();
  const t = await getDict();
  const parsedServiceId = uuidSchema.safeParse(serviceId);
  if (!parsedServiceId.success) {
    return { ok: false, error: t.feedback.checkServiceFields };
  }

  const limit = await enforceRateLimit("service:upload-image", {
    identity: admin.id,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

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
  const path = `services/${parsedServiceId.data}.${ext}`;

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
    .eq("id", parsedServiceId.data);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  updateTag("service-catalog");
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
  reason: string;
  startTime?: string;
  endTime?: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const t = await getDict();
  const parsed = blockDateSchema.safeParse(input);

  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.some((issue) => issue.path[0] === "reason");
    return { ok: false, error: reasonIssue ? t.feedback.blockReasonRequired : t.feedback.pickValidStartEnd };
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
    // A time slice applies to one day; silently ignoring `end` would block far
    // less than the admin asked for.
    if (parsed.data.endTime! <= parsed.data.startTime! || parsed.data.end !== parsed.data.start) {
      return { ok: false, error: t.feedback.endAfterStart };
    }
    starts = zonedDateTimeToUtcIso(parsed.data.start, parsed.data.startTime!);
    ends = zonedDateTimeToUtcIso(parsed.data.start, parsed.data.endTime!);
  } else {
    // Whole-day blocks are half-open shop-local ranges. Using next-day midnight
    // keeps DST days correct and avoids leaking the deployment server's zone.
    starts = zonedDateTimeToUtcIso(parsed.data.start, "00:00");
    ends = zonedDateTimeToUtcIso(addDaysToDate(parsed.data.end, 1), "00:00");
  }

  const barberId = await getShopBarberId();
  const { data: affected, error: affectedError } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", barberId)
    .eq("status", "confirmed")
    .lt("starts_at", ends)
    .gt("ends_at", starts)
    .limit(1);
  if (affectedError) {
    await reportError("availability-block-conflicts", affectedError);
    return { ok: false, error: t.common.somethingWentWrong };
  }
  if (affected?.length) {
    return { ok: false, error: t.feedback.availabilityConflictsWithBookings };
  }

  const { error } = await supabase.from("blocked_times").insert({
    barber_id: barberId,
    starts_at: starts,
    ends_at: ends,
    reason: parsed.data.reason,
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
  const parsedBlockId = uuidSchema.safeParse(blockId);
  if (!parsedBlockId.success) {
    return { ok: false, error: t.feedback.pickValidStartEnd };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_times")
    .delete()
    .eq("id", parsedBlockId.data)
    .eq("barber_id", await getShopBarberId());

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
  const parsed = z.object({ appointmentId: z.uuid(), outcome: appointmentOutcomeSchema })
    .safeParse({ appointmentId, outcome });
  if (!parsed.success) {
    return { ok: false, error: t.feedback.appointmentNotFound };
  }
  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("ends_at, status")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (appointmentError || !appointment || appointment.status !== "confirmed") {
    return { ok: false, error: t.feedback.appointmentNotFound };
  }
  if (new Date(appointment.ends_at).getTime() > Date.now()) {
    return { ok: false, error: t.feedback.appointmentNotEnded };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ outcome: parsed.data.outcome })
    .eq("id", parsed.data.appointmentId)
    .eq("status", "confirmed");

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
  if (!uuidSchema.safeParse(requestId).success) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }

  const limit = await enforceRateLimit("booking:cancel-request", {
    identity: profile.id,
    limit: 30,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("booking_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    if (error) {
      await reportError("request-cancel", error, { phase: "load-request" });
    }
    return { ok: false, error: t.feedback.requestNotFound };
  }

  if (request.client_id !== profile.id) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }

  if (request.status !== "pending" && request.status !== "proposed") {
    return { ok: false, error: t.feedback.cannotCancelConfirmed };
  }

  const { error: cancelError } = await supabase.rpc("client_cancel_request", {
    p_request_id: requestId,
  });

  if (cancelError) {
    await reportError("request-cancel", cancelError, { requestId });
    return { ok: false, error: t.feedback.cannotCancelRequest };
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
  await requireAdmin();
  const t = await getDict();
  const parsed = businessHoursSchema.safeParse(days);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidDateTime };
  }

  const barberId = await getShopBarberId();
  const supabase = getSupabaseAdminClient();
  // Refuse hours that would put any still-confirmed appointment outside the
  // new schedule. Check every page; the Data API can otherwise cap the result.
  for (let offset = 0; ; offset += 500) {
    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("barber_id", barberId)
      .eq("status", "confirmed")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .range(offset, offset + 499);
    if (appointmentsError) {
      await reportError("business-hours-conflicts", appointmentsError);
      return { ok: false, error: t.common.somethingWentWrong };
    }
    for (const appointment of appointments ?? []) {
      const date = dateInShopTimeZone(appointment.starts_at);
      const endDate = dateInShopTimeZone(appointment.ends_at);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const planned = parsed.data.find((day) => day.weekday === weekday);
      if (!planned || planned.closed || endDate !== date ||
        timeFromIso(appointment.starts_at) < planned.opensAt ||
        timeFromIso(appointment.ends_at) > planned.closesAt) {
        return { ok: false, error: t.feedback.availabilityConflictsWithBookings };
      }
    }
    if ((appointments ?? []).length < 500) break;
  }
  const rows = parsed.data.map((d) => ({
    barber_id: barberId,
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
  if (!uuidSchema.safeParse(appointmentId).success) {
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }

  const limit = await enforceRateLimit("booking:cancel-confirmed", {
    identity: profile.id,
    limit: 20,
    windowSeconds: 10 * 60,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }
  const supabase = await createClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, client_id, service_id, starts_at, status")
    .eq("id", appointmentId)
    .single();

  if (error || !appointment || appointment.client_id !== profile.id) {
    if (error) {
      await reportError("appointment-self-cancel", error, { phase: "load-appointment" });
    }
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
    await reportError("appointment-self-cancel", cancelError, { appointmentId });
    return { ok: false, error: t.feedback.appointmentTooLateToCancel };
  }

  // Notify the barber (email + notification row), non-fatal on failure.
  const barberEmail = await getShopBarberEmail();
  const cancelDate = dateInShopTimeZone(appointment.starts_at);
  const cancelTime = timeFromIso(appointment.starts_at);
  const { data: cancelService } = await supabase
    .from("services")
    .select("name")
    .eq("id", appointment.service_id)
    .single();
  const cancelSubject = `${profile.full_name} zrušil termín ${cancelDate} o ${cancelTime}`;
  await createAdminNotification({
    channel: "email",
    recipient: barberEmail,
    subject: cancelSubject,
    push: adminClientCancelledPush({
      client: profile.full_name,
      service: cancelService?.name,
      date: cancelDate,
      time: cancelTime,
    }),
    pushUrl: "/admin/calendar",
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
  const parsed = clientRescheduleSchema.safeParse({ appointmentId, date, time });
  if (!parsed.success) {
    return { ok: false, error: t.feedback.pickValidNewDateTime };
  }
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
    .select("id, client_id, service_id, starts_at, ends_at, status")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (error || !appointment || appointment.client_id !== profile.id) {
    if (error) {
      await reportError("appointment-self-reschedule", error, { phase: "load-appointment" });
    }
    return { ok: false, error: t.feedback.cannotCancelRequest };
  }
  if (appointment.status !== "confirmed") {
    return { ok: false, error: t.feedback.cannotCancelConfirmed };
  }
  if (!moreThan24hAway(appointment.starts_at)) {
    return { ok: false, error: t.feedback.rescheduleTooLate };
  }

  const newStart = startsAt(parsed.data.date, parsed.data.time);
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
  const guarded = await guardSlot(supabase, {
    barberId: await getShopBarberId(),
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes,
    start: newStart,
    end: newEnd,
    excludeAppointmentId: appointment.id,
  });
  if (!guarded.ok) {
    const error = guarded.reason === "outside-hours"
      ? t.feedback.slotOutsideHours
      : guarded.reason === "blocked"
        ? t.feedback.slotUnavailable
        : t.feedback.slotNoLongerFree;
    return { ok: false, error };
  }

  const { data: rescheduleService, error: serviceError } = await supabase
    .from("services")
    .select("name, price_cents, sunday_price_cents")
    .eq("id", appointment.service_id)
    .single();
  if (serviceError || !rescheduleService) {
    if (serviceError) {
      await reportError("appointment-self-reschedule", serviceError, { phase: "load-service" });
    }
    return { ok: false, error: t.common.somethingWentWrong };
  }

  const quote = await quoteClientSlot(supabase, {
    date: parsed.data.date,
    time: parsed.data.time,
    durationMinutes,
    basePriceCents: rescheduleService.price_cents,
    sundayPriceCents: rescheduleService.sunday_price_cents,
    excludeStartsAt: appointment.starts_at,
  });
  if (!quote.ok) {
    return { ok: false, error: t.feedback.pickGeneratedSlot };
  }

  // Service-role RPC (0032): the caller can no longer hand the database a
  // price of their choosing; the acting client is passed explicitly.
  const { error: rescheduleError } = await getSupabaseAdminClient().rpc("client_request_reschedule", {
    p_appointment_id: parsed.data.appointmentId,
    p_client_id: profile.id,
    p_new_start: newStart,
    p_price_cents: quote.priceCents,
    p_surcharge: quote.surcharge,
  });
  if (rescheduleError) {
    await reportError("appointment-self-reschedule", rescheduleError, {
      appointmentId: parsed.data.appointmentId,
    });
    return { ok: false, error: t.feedback.slotNoLongerFree };
  }

  // Notify the barber that a confirmed slot needs re-confirming at a new time.
  const barberEmail = await getShopBarberEmail();
  const rescheduleSubject = `${profile.full_name} žiada presun na ${parsed.data.date} o ${parsed.data.time}`;
  await createAdminNotification({
    channel: "email",
    recipient: barberEmail,
    subject: rescheduleSubject,
    push: adminRescheduleRequestPush({
      client: profile.full_name,
      service: rescheduleService.name,
      date: parsed.data.date,
      time: parsed.data.time,
    }),
    pushUrl: "/admin/requests",
  });
  await sendEmail({
    to: barberEmail,
    subject: rescheduleSubject,
    react: BookingRequestEmail({
      clientName: profile.full_name,
      service: rescheduleService?.name ?? "",
      date: parsed.data.date,
      time: parsed.data.time,
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
  // Deliberately requireProfile: a rejected or blocked person still has the
  // right to a copy of their data.
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin");
  }
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
  // Erasure must work for pending, rejected and blocked accounts as well.
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin");
  }
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
    await deleteClientAccount(clientId);
  } catch (error) {
    await reportError("self-delete", error, { clientId });
    return { ok: false, error: t.feedback.couldNotDeleteAccount };
  }

  // Sign out (their session is now orphaned) and send them to login.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(authNoticePath("/login", "account_deleted"));
}

// ---------------------------------------------------------------------------
// Notification center — mark the client's own notifications read (0020 policy).
// ---------------------------------------------------------------------------
export async function markNotificationsReadAction(): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const supabase = await createClient();
  const orFilter = notificationOrFilter(profile);

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  query = orFilter ? query.or(orFilter) : query.eq("user_id", profile.id);

  const { error } = await query;

  if (error) {
    await reportError("notifications-mark-read", error, { userId: profile.id, mode: "all" });
    return { ok: false, error: t.feedback.couldNotMarkNotificationsRead };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/client/notifications");
  return { ok: true, message: t.feedback.notificationsMarkedRead };
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const profile = await requireApprovedClient();
  const t = await getDict();
  const parsed = z.uuid().safeParse(notificationId);

  if (!parsed.success) {
    return { ok: false, error: t.feedback.couldNotMarkNotificationsRead };
  }

  const supabase = await createClient();
  const orFilter = notificationOrFilter(profile);

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  query = orFilter ? query.or(orFilter) : query.eq("user_id", profile.id);

  const { error } = await query;

  if (error) {
    await reportError("notifications-mark-read", error, {
      userId: profile.id,
      notificationId,
    });
    return { ok: false, error: t.feedback.couldNotMarkNotificationsRead };
  }

  revalidatePath("/client", "layout");
  revalidatePath("/client/notifications");
  return { ok: true, message: t.feedback.notificationsMarkedRead };
}
