import { eachDate } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Notification,
  Proposal,
  Service,
} from "@/domain/types";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { AuthProfile } from "@/server/auth";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// booking_requests with embedded preferences + proposals (FK-hinted).
type RequestRow = Database["public"]["Tables"]["booking_requests"]["Row"] & {
  booking_preferences?: Database["public"]["Tables"]["booking_preferences"]["Row"][];
  appointment_proposals?: Database["public"]["Tables"]["appointment_proposals"]["Row"][];
};

const REQUEST_SELECT =
  "*, booking_preferences(*), appointment_proposals!appointment_proposals_request_id_fkey(*)";

// ---------------------------------------------------------------------------
// Shared row -> domain mappers (single source of truth for conventions like
// price_cents/100, iso -> date/time, and cancelled -> declined folding).
// ---------------------------------------------------------------------------

function dateFromIso(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function timeFromIso(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function mapServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration_minutes,
    price: Math.round(row.price_cents / 100),
  };
}

export function mapClientRow(row: ProfileRow): ClientProfile {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    status: row.approval_status,
    role: row.role,
    emailConfirmed: Boolean(row.email_confirmed_at),
    createdAt: row.created_at,
  };
}

export function mapRequestRow(row: RequestRow): BookingRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    note: row.note ?? "",
    status: row.status === "cancelled" ? "declined" : row.status,
    createdAt: row.created_at,
    proposalId: row.selected_proposal_id ?? undefined,
    preferences: (row.booking_preferences ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((preference) => ({
        id: preference.id,
        rank: preference.rank,
        date: preference.preferred_date,
        window: preference.day_window,
      })),
  };
}

export function proposalsFromRequests(rows: RequestRow[]): Proposal[] {
  return rows
    .flatMap((row) => row.appointment_proposals ?? [])
    .map((proposal) => ({
      id: proposal.id,
      requestId: proposal.request_id,
      date: dateFromIso(proposal.starts_at),
      time: timeFromIso(proposal.starts_at),
      note: proposal.note ?? "",
      status: proposal.status === "expired" ? "declined" : proposal.status,
    }));
}

export function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    requestId: row.request_id,
    clientId: row.client_id,
    serviceId: row.service_id,
    date: dateFromIso(row.starts_at),
    time: timeFromIso(row.starts_at),
  };
}

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    channel: row.channel === "sms" ? "SMS" : "Email",
    to: row.recipient,
    subject: row.subject,
    createdAt: shortDate(row.created_at),
  };
}

function fail(label: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Focused loaders
// ---------------------------------------------------------------------------

export async function loadServices(): Promise<Service[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("duration_minutes");

  fail("services", error);
  return (data ?? []).map(mapServiceRow);
}

/** All services including inactive — for the admin settings manager. */
export async function loadAllServices(): Promise<
  Array<Service & { active: boolean; description: string | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("duration_minutes");

  fail("services", error);
  return (data ?? []).map((row) => ({
    ...mapServiceRow(row),
    active: row.active,
    description: row.description,
  }));
}

/** Blocked calendar days expanded from blocked_times ranges. */
export async function loadBlockedDays(): Promise<{
  dates: Set<string>;
  ranges: Array<{ id: string; start: string; end: string; reason: string | null }>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .select("*")
    .order("starts_at");

  fail("blocked_times", error);

  const dates = new Set<string>();
  const ranges = (data ?? []).map((row) => {
    for (const day of eachDate(row.starts_at, row.ends_at)) {
      dates.add(day);
    }
    return {
      id: row.id,
      start: dateFromIso(row.starts_at),
      end: dateFromIso(row.ends_at),
      reason: row.reason,
    };
  });

  return { dates, ranges };
}

export async function loadClientNotifications(
  profile: AuthProfile,
  limit = 30,
): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${profile.id},recipient.eq.${profile.email}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  fail("notifications", error);
  return (data ?? []).map(mapNotificationRow);
}

export async function loadAdminNotifications(limit = 40): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  fail("notifications", error);
  return (data ?? []).map(mapNotificationRow);
}

/** A client's own requests + derived proposals. */
export async function loadClientReservations(profile: AuthProfile): Promise<{
  requests: BookingRequest[];
  proposals: Proposal[];
  services: Service[];
}> {
  const supabase = await createClient();
  const [requestsResult, servicesResult] = await Promise.all([
    supabase
      .from("booking_requests")
      .select(REQUEST_SELECT)
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("*"),
  ]);

  fail("booking_requests", requestsResult.error);
  fail("services", servicesResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    services: (servicesResult.data ?? []).map(mapServiceRow),
  };
}

/** Everything the client overview needs in one shot. */
export async function loadClientOverview(profile: AuthProfile): Promise<{
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
  notifications: Notification[];
}> {
  const supabase = await createClient();
  const [requestsResult, appointmentsResult, servicesResult, notificationsResult] =
    await Promise.all([
      supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .eq("client_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .eq("client_id", profile.id)
        .order("starts_at"),
      supabase.from("services").select("*"),
      supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${profile.id},recipient.eq.${profile.email}`)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  fail("booking_requests", requestsResult.error);
  fail("appointments", appointmentsResult.error);
  fail("services", servicesResult.error);
  fail("notifications", notificationsResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    services: (servicesResult.data ?? []).map(mapServiceRow),
    notifications: (notificationsResult.data ?? []).map(mapNotificationRow),
  };
}

/** Services + blocked days for the booking picker. */
export async function loadBookingData(): Promise<{
  services: Service[];
  blockedDates: Set<string>;
  appointments: Appointment[];
  proposals: Proposal[];
}> {
  const supabase = await createClient();
  const [servicesResult, appointmentsResult, requestsResult, blocked] =
    await Promise.all([
      supabase.from("services").select("*").eq("active", true).order("duration_minutes"),
      supabase.from("appointments").select("*").order("starts_at"),
      supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false }),
      loadBlockedDays(),
    ]);

  fail("services", servicesResult.error);
  fail("appointments", appointmentsResult.error);
  fail("booking_requests", requestsResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    blockedDates: blocked.dates,
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    proposals: proposalsFromRequests(rows),
  };
}

/** Admin overview metrics + recent activity. */
export async function loadAdminOverview(): Promise<{
  clients: ClientProfile[];
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  notifications: Notification[];
  services: Service[];
}> {
  const supabase = await createClient();
  const [
    servicesResult,
    profilesResult,
    requestsResult,
    appointmentsResult,
    notificationsResult,
  ] = await Promise.all([
    supabase.from("services").select("*"),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("booking_requests").select(REQUEST_SELECT).order("created_at", {
      ascending: false,
    }),
    supabase.from("appointments").select("*").order("starts_at"),
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  fail("services", servicesResult.error);
  fail("profiles", profilesResult.error);
  fail("booking_requests", requestsResult.error);
  fail("appointments", appointmentsResult.error);
  fail("notifications", notificationsResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    clients: (profilesResult.data ?? []).map(mapClientRow),
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    notifications: (notificationsResult.data ?? []).map(mapNotificationRow),
  };
}

/** Admin calendar: confirmed appointments + open proposals + clients/services. */
export async function loadAdminCalendar(): Promise<{
  appointments: Appointment[];
  proposals: Proposal[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  blockedDates: Set<string>;
}> {
  const supabase = await createClient();
  const [servicesResult, profilesResult, requestsResult, appointmentsResult, blocked] =
    await Promise.all([
      supabase.from("services").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("booking_requests").select(REQUEST_SELECT).order("created_at", {
        ascending: false,
      }),
      supabase.from("appointments").select("*").order("starts_at"),
      loadBlockedDays(),
    ]);

  fail("services", servicesResult.error);
  fail("profiles", profilesResult.error);
  fail("booking_requests", requestsResult.error);
  fail("appointments", appointmentsResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    clients: (profilesResult.data ?? []).map(mapClientRow),
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    blockedDates: blocked.dates,
  };
}

/** Pending approvals (email-confirmed) + their requested preferences. */
export async function loadApprovals(): Promise<{
  clients: ClientProfile[];
  requests: BookingRequest[];
  services: Service[];
}> {
  const supabase = await createClient();
  const [profilesResult, requestsResult, servicesResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("booking_requests").select(REQUEST_SELECT),
    supabase.from("services").select("*"),
  ]);

  fail("profiles", profilesResult.error);
  fail("booking_requests", requestsResult.error);
  fail("services", servicesResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    clients: (profilesResult.data ?? []).map(mapClientRow),
    requests: rows.map(mapRequestRow),
    services: (servicesResult.data ?? []).map(mapServiceRow),
  };
}

/** The proposal composer queue. */
export async function loadRequestQueue(): Promise<{
  clients: ClientProfile[];
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
}> {
  const supabase = await createClient();
  const [servicesResult, profilesResult, requestsResult, appointmentsResult] =
    await Promise.all([
      supabase.from("services").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("booking_requests").select(REQUEST_SELECT).order("created_at", {
        ascending: false,
      }),
      supabase.from("appointments").select("*").order("starts_at"),
    ]);

  fail("services", servicesResult.error);
  fail("profiles", profilesResult.error);
  fail("booking_requests", requestsResult.error);
  fail("appointments", appointmentsResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    clients: (profilesResult.data ?? []).map(mapClientRow),
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
  };
}

/** Directory of all clients. */
export async function loadClients(): Promise<ClientProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  fail("profiles", error);
  return (data ?? []).map(mapClientRow);
}

/** One client's full history for the admin detail page. */
export async function loadClientHistory(clientId: string): Promise<{
  client: ClientProfile | null;
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
}> {
  const supabase = await createClient();
  const [profileResult, requestsResult, appointmentsResult, servicesResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", clientId).maybeSingle(),
      supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("starts_at"),
      supabase.from("services").select("*"),
    ]);

  fail("profiles", profileResult.error);
  fail("booking_requests", requestsResult.error);
  fail("appointments", appointmentsResult.error);
  fail("services", servicesResult.error);

  const rows = (requestsResult.data ?? []) as RequestRow[];
  return {
    client: profileResult.data ? mapClientRow(profileResult.data) : null,
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    services: (servicesResult.data ?? []).map(mapServiceRow),
  };
}

