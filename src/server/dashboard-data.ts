import { analyticsPeriodStart } from "@/domain/analytics";
import { DEFAULT_BOOKING_CONTACT, type BookingContact } from "@/domain/shop-contact";
import { unstable_cache } from "next/cache";
import { adminCalendarWindowDates } from "@/domain/calendar-window";
import {
  DEFAULT_PRICING_SETTINGS,
  addDays,
  blockedRangeFromRow,
  isShopDayFullyBlocked,
  latestClientBookingDate,
  surchargeDetailsForRequest,
  todayIso,
} from "@/domain/schedule";
import type {
  Appointment,
  BlockedInterval,
  BlockedRange,
  BookingRequest,
  BusinessHoursDay,
  ClientAppointment,
  ConfirmedRequestSlot,
  ClientProfile,
  Notification,
  PricingSettings,
  Proposal,
  Service,
} from "@/domain/types";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { addDaysToDate, dateInShopTimeZone, formatInShopTimeZone, shopDayRangeUtc, timeInShopTimeZone } from "@/lib/time-zone";
import { requireAdmin, type AuthProfile } from "@/server/auth";
import { getShopBarberId } from "@/server/shop-barber";
import { readAllPages } from "@/server/paginated-read";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
// Only the columns the UI needs; never pull calendar_token into page payloads.
type ClientRow = Pick<
  ProfileRow,
  "id" | "full_name" | "email" | "phone" | "role" | "approval_status" | "email_confirmed_at" | "created_at" | "avatar_url"
>;
type AppointmentRow = Pick<
  Database["public"]["Tables"]["appointments"]["Row"],
  | "id"
  | "request_id"
  | "client_id"
  | "customer_name"
  | "service_id"
  | "starts_at"
  | "ends_at"
  | "price_cents"
  | "note"
  | "status"
  | "outcome"
>;
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type PricingSettingsRow = Pick<
  Database["public"]["Tables"]["pricing_settings"]["Row"],
  "gap_surcharge_percent" | "vip_surcharge_percent"
>;
type BusySlotRow = Database["public"]["Functions"]["confirmed_appointment_slots"]["Returns"][number];

// booking_requests with embedded preferences + proposals (FK-hinted).
type RequestBaseRow = Database["public"]["Tables"]["booking_requests"]["Row"];
type RequestRow = Pick<
  RequestBaseRow,
  "id" | "client_id" | "service_id" | "status" | "created_at" |
  "selected_proposal_id" | "requested_start" | "price_cents" | "surcharge"
> & Partial<Pick<RequestBaseRow, "note">> & {
  booking_preferences?: Database["public"]["Tables"]["booking_preferences"]["Row"][];
  appointment_proposals?: Database["public"]["Tables"]["appointment_proposals"]["Row"][];
};

const REQUEST_SELECT =
  "*, booking_preferences(*), appointment_proposals!appointment_proposals_request_id_fkey(*)";
const REQUEST_SUMMARY_SELECT =
  "id, client_id, service_id, status, created_at, selected_proposal_id, requested_start, price_cents, surcharge";
const APPOINTMENT_SELECT =
  "id, request_id, client_id, customer_name, service_id, starts_at, ends_at, price_cents, note, status, outcome";
const PROFILE_SELECT =
  "id, full_name, email, phone, role, approval_status, email_confirmed_at, created_at, avatar_url";

// The service catalog changes through admin actions, which expire this tag.
// Keep appointment slots, blocks, hours and prices out of the persistent cache.
const loadCachedServices = unstable_cache(async (activeOnly: boolean): Promise<Service[]> => {
  let query = getSupabaseAdminClient().from("services").select("*");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query.order("duration_minutes");
  fail("services", error);
  return (data ?? []).map(mapServiceRow);
}, ["service-catalog-v1"], { tags: ["service-catalog"], revalidate: 300 });

// Analytics never looks back further than 12 trailing months (plus the month
// before for period-over-period comparison), so admin loaders bound history
// there instead of shipping every appointment ever booked.
function analyticsFloorIso() {
  return shopDayRangeUtc(analyticsPeriodStart(todayIso(), 13)).startIso;
}

// ---------------------------------------------------------------------------
// Shared row -> domain mappers (single source of truth for conventions like
// price_cents/100, iso -> date/time, and cancelled -> declined folding).
// ---------------------------------------------------------------------------

function dateFromIso(value: string) {
  return dateInShopTimeZone(value);
}

function timeFromIso(value: string) {
  return timeInShopTimeZone(value);
}

function shortDate(value: string) {
  return formatInShopTimeZone(value, {
    month: "short",
    day: "numeric",
  });
}

function mapBusySlotRow(row: BusySlotRow): Appointment {
  return {
    id: `busy-${row.starts_at}-${row.service_id}`,
    requestId: null,
    clientId: null,
    serviceId: row.service_id,
    date: dateFromIso(row.starts_at),
    time: timeFromIso(row.starts_at),
    durationMinutes: Math.round(
      (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000,
    ),
    status: "confirmed",
  };
}

export function mapServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    duration: row.duration_minutes,
    price: row.price_cents / 100,
    sundayPrice: row.sunday_price_cents / 100,
    active: row.active,
    imageUrl: row.image_url,
  };
}

/** Include only hidden services referenced by this client's own RLS-scoped rows. */
async function includeBookedServices(
  visibleRows: ServiceRow[],
  bookedServiceIds: Iterable<string>,
): Promise<Service[]> {
  const knownIds = new Set(visibleRows.map((row) => row.id));
  const missingIds = [...new Set(bookedServiceIds)].filter((id) => !knownIds.has(id));
  if (missingIds.length === 0) return visibleRows.map(mapServiceRow);

  // The caller supplies IDs exclusively from the signed-in client's requests
  // and appointments. Keep this service-role read scoped to those IDs.
  const { data, error } = await getSupabaseAdminClient()
    .from("services")
    .select("*")
    .in("id", missingIds);
  fail("historical_services", error);
  return [...visibleRows, ...(data ?? [])].map(mapServiceRow);
}

function mapPricingSettingsRow(row: PricingSettingsRow): PricingSettings {
  return {
    gapSurchargePercent: row.gap_surcharge_percent,
    vipSurchargePercent: row.vip_surcharge_percent,
  };
}

export function mapClientRow(row: ClientRow): ClientProfile {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    status: row.approval_status,
    role: row.role,
    emailConfirmed: Boolean(row.email_confirmed_at),
    createdAt: row.created_at,
    avatarUrl: row.avatar_url,
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
    requestedDate: row.requested_start ? dateFromIso(row.requested_start) : undefined,
    requestedTime: row.requested_start ? timeFromIso(row.requested_start) : undefined,
    priceCents: row.price_cents ?? undefined,
    surcharge: row.surcharge ?? undefined,
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
    clientName: row.customer_name ?? undefined,
    serviceId: row.service_id,
    date: dateFromIso(row.starts_at),
    time: timeFromIso(row.starts_at),
    durationMinutes: Math.round(
      (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000,
    ),
    priceCents: row.price_cents,
    note: row.note,
    status: row.status,
    outcome: row.outcome,
  };
}

/** Confirmed appointments only — cancelled rows must never render as booked. */
export function confirmedOnly(rows: AppointmentRow[] | null | undefined): AppointmentRow[] {
  return (rows ?? []).filter((row) => row.status === "confirmed");
}

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    channel: row.channel === "sms" ? "SMS" : "Email",
    to: row.recipient,
    subject: row.subject,
    body: row.body,
    read: row.read_at != null,
    actionUrl: row.action_url,
    createdAt: shortDate(row.created_at),
  };
}

function fail(label: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function asRequestRows(data: unknown): RequestRow[] {
  return Array.isArray(data) ? (data as RequestRow[]) : [];
}

// ---------------------------------------------------------------------------
// Focused loaders
// ---------------------------------------------------------------------------

// Counts of items needing the barber's attention, for the sidebar badges.
// Computed server-side so they refresh through the same revalidatePath() that
// updates the rest of the admin UI after an approve/confirm/cancel action —
// realtime is only a live-update bonus, not the source of truth.
export type AttentionCounts = { requests: number; approvals: number };

export async function loadAttentionCounts(): Promise<AttentionCounts> {
  const supabase = await createClient();
  const [requestsResult, approvalsResult] = await Promise.all([
    supabase
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Pending sign-ups with a confirmed email and a phone on file — the rows
    // the approval queue treats as actionable (see domain/approval.ts).
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending")
      .not("email_confirmed_at", "is", null)
      .not("phone", "is", null),
  ]);

  return {
    requests: requestsResult.count ?? 0,
    approvals: approvalsResult.count ?? 0,
  };
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
    imageUrl: row.image_url,
  }));
}

export async function loadPricingSettings(barberId?: string): Promise<PricingSettings> {
  const supabase = await createClient();
  const shopBarberId = barberId ?? await getShopBarberId();
  const query = supabase
    .from("pricing_settings")
    .select("gap_surcharge_percent, vip_surcharge_percent")
    .eq("barber_id", shopBarberId)
    .limit(1);

  const { data, error } = await query;
  fail("pricing_settings", error);
  if (!data || data.length === 0) return DEFAULT_PRICING_SETTINGS;

  return mapPricingSettingsRow(data[0]);
}

/** Customer-facing booking address and phone, managed by the shop barber. */
export async function loadBookingContactSettings(): Promise<BookingContact> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_contact_settings")
    .select("address, phone")
    .eq("barber_id", await getShopBarberId())
    .maybeSingle();

  fail("booking_contact_settings", error);
  return data ? { address: data.address, phone: data.phone } : DEFAULT_BOOKING_CONTACT;
}

/** Blocked calendar days expanded from blocked_times ranges. */
export async function loadBlockedDays(window?: { fromIso: string; toIso: string }): Promise<{
  dates: Set<string>;
  /** Reason-free intervals: safe for client availability payloads. */
  intervals: BlockedInterval[];
  /** The same intervals with the barber's reason, for admin views only. */
  labeledIntervals: BlockedInterval[];
  ranges: BlockedRange[];
}> {
  const supabase = await createClient();
  const barberId = await getShopBarberId();
  const rows = await readAllPages("blocked_times", (from, to) => {
    let query = supabase
      .from("blocked_times")
      .select("id, starts_at, ends_at, reason")
      .eq("barber_id", barberId);
    if (window) query = query.lt("starts_at", window.toIso).gt("ends_at", window.fromIso);
    return query.order("starts_at").order("id").range(from, to);
  });

  const intervals = rows.map((row) => ({ start: row.starts_at, end: row.ends_at }));
  const labeledIntervals = rows.map((row) => ({ start: row.starts_at, end: row.ends_at, reason: row.reason }));
  const ranges = rows.map((row) => blockedRangeFromRow(row, window));
  const candidateDates = new Set<string>();
  for (const range of ranges) {
    for (let day = range.start; day <= range.end; day = addDaysToDate(day, 1)) {
      candidateDates.add(day);
    }
  }

  const dates = new Set(
    [...candidateDates].filter((day) => isShopDayFullyBlocked(day, intervals)),
  );

  return { dates, intervals, labeledIntervals, ranges };
}

// A PostgREST `.or()` filter is a comma/paren-delimited string, so an email
// containing those characters would corrupt the expression. Emails are already
// validated at registration, but we defensively fall back to the safe user_id
// filter if the address contains any delimiter the filter grammar reserves.
export function notificationOrFilter(profile: AuthProfile): string | null {
  const email = profile.email;
  if (!email || /[,()"']/.test(email)) return null;
  return `user_id.eq.${profile.id},recipient.eq.${email}`;
}

export async function loadClientNotifications(
  profile: AuthProfile,
  limit = 30,
): Promise<Notification[]> {
  const supabase = await createClient();
  const orFilter = notificationOrFilter(profile);
  let query = supabase.from("notifications").select("*");
  query = orFilter
    ? query.or(orFilter)
    : query.eq("user_id", profile.id);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  fail("notifications", error);
  return (data ?? []).map(mapNotificationRow);
}

// Count of the client's unread notifications, for the nav badge. Mirrors the
// admin attention-count pattern: server-computed and refreshed via
// revalidatePath after any action that reads/creates notifications.
export async function loadUnreadNotificationCount(profile: AuthProfile): Promise<number> {
  const supabase = await createClient();
  const orFilter = notificationOrFilter(profile);
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  query = orFilter ? query.or(orFilter) : query.eq("user_id", profile.id);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/** The caller's own calendar feed token (never included in page payloads). */
export async function loadCalendarToken(profileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("calendar_token")
    .eq("id", profileId)
    .maybeSingle();
  return data?.calendar_token ?? null;
}

/** Shared shop calendar token, readable only after an admin page gate. */
export async function loadShopCalendarToken(): Promise<string | null> {
  await requireAdmin();
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("calendar_token")
    .eq("id", await getShopBarberId())
    .maybeSingle();
  fail("shop calendar token", error);
  return data?.calendar_token ?? null;
}

/** A client's own requests + derived proposals + actionable upcoming appts. */
export async function loadClientReservations(profile: AuthProfile): Promise<{
  requests: BookingRequest[];
  proposals: Proposal[];
  services: Service[];
  upcomingAppointments: ClientAppointment[];
  confirmedRequestSlots: ConfirmedRequestSlot[];
}> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [requestRows, servicesResult, appointmentRows] = await Promise.all([
    readAllPages("booking_requests", (from, to) => supabase
      .from("booking_requests")
      .select(REQUEST_SELECT)
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("services").select("*"),
    readAllPages("appointments", (from, to) => supabase
      .from("appointments")
      .select("id, request_id, service_id, starts_at, status")
      .eq("client_id", profile.id)
      .eq("status", "confirmed")
      .order("starts_at", { ascending: false }).order("id").range(from, to)),
  ]);

  fail("services", servicesResult.error);

  const rows = asRequestRows(requestRows);
  const services = await includeBookedServices(
    servicesResult.data ?? [],
    [...rows.map((row) => row.service_id), ...appointmentRows.map((row) => row.service_id)],
  );
  const cutoff = Date.now() + 24 * 60 * 60 * 1000;
  const upcomingAppointments: ClientAppointment[] = appointmentRows
    .filter((a) => a.starts_at >= nowIso)
    .map(
    (a) => ({
      id: a.id,
      serviceId: a.service_id,
      date: dateFromIso(a.starts_at),
      time: timeFromIso(a.starts_at),
      canModify: new Date(a.starts_at).getTime() > cutoff,
    }),
  );
  const confirmedRequestSlots: ConfirmedRequestSlot[] = appointmentRows
    .filter((a): a is typeof a & { request_id: string } => Boolean(a.request_id))
    .map((a) => ({
      requestId: a.request_id,
      date: dateFromIso(a.starts_at),
      time: timeFromIso(a.starts_at),
    }));

  return {
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    services,
    upcomingAppointments,
    confirmedRequestSlots,
  };
}

export type ClientAppointmentDetail = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceActive: boolean;
  serviceDuration: number;
  date: string;
  time: string;
  startIso: string;
  endIso: string;
  status: string;
  outcome: string | null;
  priceCents: number | null;
  surcharge: boolean;
  surchargeKind: "gap" | "vip" | null;
  surchargePercent: number | null;
  canModify: boolean;
};

/** One of the client's own appointments, for the detail page. Null if not theirs. */
export async function loadClientAppointmentDetail(
  profile: AuthProfile,
  appointmentId: string,
): Promise<ClientAppointmentDetail | null> {
  const supabase = await createClient();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, request_id, service_id, starts_at, ends_at, price_cents, status, outcome, client_id")
    .eq("id", appointmentId)
    .single();

  if (error || !appt || appt.client_id !== profile.id) return null;

  const [{ data: visibleService }, requestResult, pricingSettings] = await Promise.all([
    supabase.from("services").select("name, duration_minutes, active").eq("id", appt.service_id).maybeSingle(),
    appt.request_id
      ? supabase
          .from("booking_requests")
          .select("price_cents, surcharge, requested_start")
          .eq("id", appt.request_id)
          .single()
      : Promise.resolve({ data: null }),
    loadPricingSettings(),
  ]);
  const hiddenServiceResult = visibleService
    ? null
    : await getSupabaseAdminClient()
        .from("services")
        .select("name, duration_minutes, active")
        .eq("id", appt.service_id)
        .maybeSingle();
  if (hiddenServiceResult) fail("historical_service", hiddenServiceResult.error);
  const service = visibleService ?? hiddenServiceResult?.data;
  const surcharge = surchargeDetailsForRequest(
    {
      surcharge: requestResult.data?.surcharge ?? false,
      requestedTime: requestResult.data?.requested_start
        ? timeFromIso(requestResult.data.requested_start)
        : undefined,
    },
    pricingSettings,
  );

  return {
    id: appt.id,
    serviceId: appt.service_id,
    serviceName: service?.name ?? "",
    serviceActive: service?.active ?? false,
    serviceDuration: Math.round((Date.parse(appt.ends_at) - Date.parse(appt.starts_at)) / 60_000),
    date: dateFromIso(appt.starts_at),
    time: timeFromIso(appt.starts_at),
    startIso: appt.starts_at,
    endIso: appt.ends_at,
    status: appt.status,
    outcome: appt.outcome,
    priceCents: appt.price_cents ?? requestResult.data?.price_cents ?? null,
    surcharge: requestResult.data?.surcharge ?? false,
    surchargeKind: surcharge?.kind ?? null,
    surchargePercent: surcharge?.percent ?? null,
    canModify:
      appt.status === "confirmed" &&
      new Date(appt.starts_at).getTime() > Date.now() + 24 * 60 * 60 * 1000,
  };
}

/** Everything the client overview needs in one shot. */
export async function loadClientOverview(profile: AuthProfile): Promise<{
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
  blockedRanges: BlockedRange[];
}> {
  const supabase = await createClient();
  const blockedWindow = {
    fromIso: shopDayRangeUtc(todayIso()).startIso,
    toIso: shopDayRangeUtc(addDaysToDate(latestClientBookingDate(), 1)).startIso,
  };
  const [requestRows, appointmentRows, servicesResult, blocked] = await Promise.all([
    readAllPages("booking_requests", (from, to) => supabase
      .from("booking_requests")
      .select(REQUEST_SELECT)
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }).order("id").range(from, to)),
    readAllPages("appointments", (from, to) => supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("client_id", profile.id)
      .eq("status", "confirmed")
      .order("starts_at").order("id").range(from, to)),
    supabase.from("services").select("*"),
    loadBlockedDays(blockedWindow),
  ]);

  fail("services", servicesResult.error);

  const rows = asRequestRows(requestRows);
  const services = await includeBookedServices(
    servicesResult.data ?? [],
    [...rows.map((row) => row.service_id), ...appointmentRows.map((row) => row.service_id)],
  );
  return {
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: appointmentRows.map(mapAppointmentRow),
    services,
    blockedRanges: blocked.ranges,
  };
}

/** Services + blocked days + booked/pending context for the booking picker. */
export async function loadBookingData(options: { includeServices?: boolean } = {}): Promise<{
  services: Service[];
  pricingSettings: PricingSettings;
  businessHours: BusinessHoursDay[];
  blockedDates: Set<string>;
  blockedIntervals: BlockedInterval[];
  appointments: Appointment[];
  // Pending exact-slot requests visible to the caller — shown as a soft
  // "Requested" badge in the picker (still selectable, don't block).
  pendingRequests: BookingRequest[];
}> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const fromIso = shopDayRangeUtc(todayIso()).startIso;
  const toIso = shopDayRangeUtc(addDaysToDate(latestClientBookingDate(), 1)).startIso;
  const [services, appointmentRows, requestRows, blocked, pricingSettings, businessHours] =
    await Promise.all([
      options.includeServices === false
        ? Promise.resolve([] as Service[])
        : loadCachedServices(true),
      readAllPages("confirmed_appointment_slots_window", (from, to) => supabase
        .rpc("confirmed_appointment_slots_window", { p_from: fromIso, p_to: toIso })
        .order("starts_at").order("id").range(from, to)),
      readAllPages("booking_requests", (from, to) => supabase
        .from("booking_requests")
        .select(REQUEST_SUMMARY_SELECT)
        .eq("status", "pending")
        .gte("requested_start", nowIso)
        .lt("requested_start", toIso)
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      loadBlockedDays({ fromIso, toIso }),
      loadPricingSettings(),
      loadBusinessHours(),
    ]);

  const rows = asRequestRows(requestRows);
  const requests = rows.map(mapRequestRow);
  return {
    services,
    pricingSettings,
    businessHours,
    blockedDates: blocked.dates,
    blockedIntervals: blocked.intervals,
    appointments: appointmentRows.map(mapBusySlotRow),
    pendingRequests: requests.filter(
      (r) => Boolean(r.requestedDate),
    ),
  };
}

/**
 * Admin overview metrics + recent activity. `appointments` holds confirmed rows
 * for the booking strip / upcoming list; `analyticsAppointments` also includes
 * cancelled rows so outcome charts can count cancellations.
 */
export async function loadAdminOverview(): Promise<{
  services: Service[];
  clients: ClientProfile[];
  requests: BookingRequest[];
  appointments: Appointment[];
  analyticsAppointments: Appointment[];
  pricingSettings: PricingSettings;
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
}> {
  const supabase = await createClient();
  const floor = analyticsFloorIso();
  const barberId = await getShopBarberId();
  const [servicesResult, profileRows, requestRows, appointmentRows, pricingSettings, businessHours, blocked] =
    await Promise.all([
      supabase.from("services").select("*"),
      readAllPages("profiles", (from, to) => supabase.from("profiles")
        .select(PROFILE_SELECT).order("created_at", { ascending: false }).order("id").range(from, to)),
      readAllPages("booking_requests", (from, to) => supabase
        .from("booking_requests")
        .select(REQUEST_SUMMARY_SELECT)
        .gte("created_at", floor)
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      readAllPages("appointments", (from, to) => supabase.from("appointments").select(APPOINTMENT_SELECT)
        .eq("barber_id", barberId).gte("starts_at", floor)
        .order("starts_at").order("id").range(from, to)),
      loadPricingSettings(),
      loadBusinessHours(),
      loadBlockedDays(),
    ]);

  fail("services", servicesResult.error);
  const rows = asRequestRows(requestRows);
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    clients: profileRows.map(mapClientRow),
    requests: rows.map(mapRequestRow),
    appointments: confirmedOnly(appointmentRows).map(mapAppointmentRow),
    analyticsAppointments: appointmentRows.map(mapAppointmentRow),
    pricingSettings,
    businessHours,
    blockedIntervals: blocked.intervals,
  };
}

/** UTC bounds for the admin calendar query around the requested date. */
export function adminCalendarWindow(date: string) {
  const anchorDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();
  const { fromDate, toDate } = adminCalendarWindowDates(anchorDate, anchorDate);
  return {
    anchorDate,
    fromDate,
    toDate,
    fromIso: shopDayRangeUtc(fromDate).startIso,
    toIso: shopDayRangeUtc(toDate).startIso,
  };
}

/** Admin calendar: confirmed appointments + open proposals + clients/services. */
export async function loadAdminCalendar(window: { fromIso: string; toIso: string }): Promise<{
  appointments: Appointment[];
  proposals: Proposal[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  pricingSettings: PricingSettings;
  blockedDates: Set<string>;
  blockedIntervals: BlockedInterval[];
  businessHours: BusinessHoursDay[];
}> {
  const supabase = await createClient();
  const barberId = await getShopBarberId();
  const [services, profileRows, requestRows, appointmentRows, blocked, pricingSettings, businessHours] =
    await Promise.all([
      loadCachedServices(false),
      readAllPages("profiles", (from, to) => supabase.from("profiles")
        .select(PROFILE_SELECT).order("id").range(from, to)),
      // Only open requests can still render as proposals on the calendar.
      readAllPages("booking_requests", (from, to) => supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .in("status", ["pending", "proposed"])
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      readAllPages("appointments", (from, to) => supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("barber_id", barberId)
        .gte("starts_at", window.fromIso)
        .lt("starts_at", window.toIso)
        .order("starts_at").order("id").range(from, to)),
      loadBlockedDays(window),
      loadPricingSettings(),
      loadBusinessHours(),
    ]);

  const rows = asRequestRows(requestRows);
  return {
    services,
    clients: profileRows.map(mapClientRow),
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: confirmedOnly(appointmentRows).map(mapAppointmentRow),
    pricingSettings,
    blockedDates: blocked.dates,
    // Admin-only payload: the calendar shows each block's reason.
    blockedIntervals: blocked.labeledIntervals,
    businessHours,
  };
}

/** Client accounts awaiting an access decision, including unverified sign-ups. */
export async function loadApprovals(): Promise<{
  clients: ClientProfile[];
}> {
  const supabase = await createClient();
  const rows = await readAllPages("profiles", (from, to) => supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("role", "client")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false }).order("id").range(from, to));

  return {
    clients: rows.map(mapClientRow),
  };
}

/** The proposal composer queue. */
export async function loadRequestQueue(): Promise<{
  clients: ClientProfile[];
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
  pricingSettings: PricingSettings;
  blockedDates: Set<string>;
}> {
  const supabase = await createClient();
  const floor = analyticsFloorIso();
  const recentIso = shopDayRangeUtc(addDays(-90)).startIso;
  const barberId = await getShopBarberId();
  const [servicesResult, profileRows, requestRows, appointmentRows, blocked, pricingSettings] =
    await Promise.all([
      supabase.from("services").select("*"),
      readAllPages("profiles", (from, to) => supabase.from("profiles")
        .select(PROFILE_SELECT).order("id").range(from, to)),
      // Every open request, plus the last 90 days of closed ones for the
      // history tabs; older declined/cancelled rows are not worth the payload.
      readAllPages("booking_requests", (from, to) => supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .or(`status.in.(pending,proposed),created_at.gte.${recentIso}`)
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      // Trailing year: enough for same-day conflict checks and no-show counts.
      readAllPages("appointments", (from, to) => supabase.from("appointments").select(APPOINTMENT_SELECT)
        .eq("barber_id", barberId).gte("starts_at", floor)
        .order("starts_at").order("id").range(from, to)),
      loadBlockedDays(),
      loadPricingSettings(),
    ]);

  fail("services", servicesResult.error);
  const rows = asRequestRows(requestRows);
  return {
    services: (servicesResult.data ?? []).map(mapServiceRow),
    clients: profileRows.map(mapClientRow),
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: confirmedOnly(appointmentRows).map(mapAppointmentRow),
    pricingSettings,
    blockedDates: blocked.dates,
  };
}

/** Directory of all clients. */
export async function loadClients(): Promise<ClientProfile[]> {
  const supabase = await createClient();
  const rows = await readAllPages("profiles", (from, to) => supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("created_at", { ascending: false }).order("id").range(from, to));
  return rows.map(mapClientRow);
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
  const [profileResult, requestRows, appointmentRows, servicesResult] =
    await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT).eq("id", clientId).maybeSingle(),
      readAllPages("booking_requests", (from, to) => supabase
        .from("booking_requests")
        .select(REQUEST_SELECT)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      // Reschedules retain cancelled rows for audit/analytics; the profile
      // lists actual bookings, not each historical version.
      readAllPages("appointments", (from, to) => supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("client_id", clientId)
        .eq("status", "confirmed")
        .order("starts_at").order("id").range(from, to)),
      supabase.from("services").select("*"),
    ]);

  fail("profiles", profileResult.error);
  fail("services", servicesResult.error);

  const rows = asRequestRows(requestRows);
  return {
    client: profileResult.data ? mapClientRow(profileResult.data) : null,
    requests: rows.map(mapRequestRow),
    proposals: proposalsFromRequests(rows),
    appointments: appointmentRows.map(mapAppointmentRow),
    services: (servicesResult.data ?? []).map(mapServiceRow),
  };
}


// ---------------------------------------------------------------------------
// Calendar export (.ics). Reads the RAW timestamptz instants (not the lossy
// domain date/time mapping) so the exported absolute times are exact. Confirmed
// appointments only, within [fromIso, toIso). Joins done in JS to avoid the
// embedded-select typing issues caused by the empty Relationships arrays.
// ---------------------------------------------------------------------------

export type ExportEvent = {
  id: string;
  start: Date;
  end: Date;
  serviceName: string;
  customer: string;
};

export async function loadExportAppointments(
  fromIso: string,
  toIso: string,
  // When set, only that client's appointments are returned (client self-export).
  // Omitted for the admin, who exports the shop barber's schedule. RLS still applies:
  // clients can read all appointment rows but only their own profile, so the
  // customer name resolves to their own name (fine — it's their calendar).
  clientId?: string,
): Promise<ExportEvent[]> {
  const supabase = await createClient();
  const barberId = clientId ? null : await getShopBarberId();
  const [appointmentRows, servicesResult, profileRows] = await Promise.all([
    readAllPages("appointments", (from, to) => {
      let query = supabase.from("appointments").select(APPOINTMENT_SELECT)
        .eq("status", "confirmed").gte("starts_at", fromIso).lt("starts_at", toIso);
      query = clientId ? query.eq("client_id", clientId) : query.eq("barber_id", barberId!);
      return query.order("starts_at").order("id").range(from, to);
    }),
    supabase.from("services").select("id, name"),
    readAllPages("profiles", (from, to) => supabase.from("profiles")
      .select("id, full_name").order("id").range(from, to)),
  ]);

  fail("services", servicesResult.error);

  const serviceName = new Map(
    (servicesResult.data ?? []).map((s) => [s.id, s.name]),
  );
  const clientName = new Map(
    profileRows.map((p) => [p.id, p.full_name]),
  );

  return appointmentRows.map((row) => ({
    id: row.id,
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    serviceName: serviceName.get(row.service_id) ?? "",
    customer:
      (row.client_id ? clientName.get(row.client_id) : undefined) ??
      row.customer_name ??
      "Walk-in",
  }));
}

// ---------------------------------------------------------------------------
// Admin audit log
// ---------------------------------------------------------------------------

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
};

// Recent admin actions for the audit viewer. Resolves actor_id → name in JS
// (RLS lets an admin read all profiles). Read is admin-only via the table's RLS
// policy; this loader is only ever called behind requireAdmin().
export async function loadAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  fail("admin_audit_log", error);

  const actorIds = Array.from(
    new Set((data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
  );
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const actor of actors ?? []) actorName.set(actor.id, actor.full_name);
  }

  return (data ?? []).map((row) => {
    const detail = row.detail && typeof row.detail === "object" && Object.keys(row.detail).length > 0
      ? JSON.stringify(row.detail)
      : null;
    return {
      id: row.id,
      actor: (row.actor_id && actorName.get(row.actor_id)) || "—",
      action: row.action,
      target: row.target_id ? `${row.target_type ?? ""}:${row.target_id}` : null,
      detail,
      createdAt: formatInShopTimeZone(row.created_at, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Business hours
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Default 7-day schedule (07:00–21:00, closed Sunday) used when the admin
// hasn't configured custom hours yet.
const DEFAULT_HOURS: BusinessHoursDay[] = Array.from({ length: 7 }, (_, w) => ({
  weekday: w,
  opensAt: "07:00",
  closesAt: "21:00",
  closed: w === 0, // Sunday closed by default
}));

export async function loadBusinessHours(barberId?: string): Promise<BusinessHoursDay[]> {
  const supabase = await createClient();
  const shopBarberId = barberId ?? await getShopBarberId();

  const query = supabase
    .from("business_hours")
    .select("barber_id, weekday, opens_at, closes_at, closed")
    .eq("barber_id", shopBarberId)
    .order("weekday");

  const { data, error } = await query;
  fail("business_hours", error);
  if (!data || data.length === 0) return DEFAULT_HOURS;

  // Fill in any missing weekdays with defaults.
  return DEFAULT_HOURS.map((def) => {
    const row = data.find((r) => r.weekday === def.weekday);
    if (!row) return def;
    return {
      weekday: row.weekday,
      opensAt: row.opens_at.slice(0, 5),
      closesAt: row.closes_at.slice(0, 5),
      closed: row.closed ?? false,
    };
  });
}

export { WEEKDAY_NAMES };
