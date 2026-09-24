export type Role = "client" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "blocked";

export type RequestStatus = "pending" | "proposed" | "confirmed" | "declined";

export type ProposalStatus = "sent" | "accepted" | "declined" | "expired";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type NotificationChannel = "Email" | "SMS";

export type DayWindow = "Morning" | "Midday" | "Afternoon" | "Evening";

export type ViewMode = "calendar" | "list";

export type ClientProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: ApprovalStatus;
  role: Role;
  emailConfirmed: boolean;
  createdAt: string;
  avatarUrl?: string | null;
};

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  /** Regular (Monday–Saturday) list price in euros. */
  price: number;
  /** Sunday list price in euros; Sunday bookings quote from this base instead. */
  sundayPrice: number;
  /** Hidden services remain readable only when attached to the client's history. */
  active?: boolean;
  imageUrl?: string | null;
};

export type PricingSettings = {
  gapSurchargePercent: number;
  vipSurchargePercent: number;
};

export type Preference = {
  id: string;
  rank: number;
  date: string;
  window: DayWindow;
};

export type BookingRequest = {
  id: string;
  clientId: string;
  serviceId: string;
  note: string;
  // Legacy 3-window preferences (kept optional for old rows; new flow is empty).
  preferences: Preference[];
  status: RequestStatus;
  createdAt: string;
  proposalId?: string;
  // Exact slot the client picked (new flow). yyyy-mm-dd + HH:MM, plus the price
  // computed at booking time and whether a gap or VIP surcharge applied.
  requestedDate?: string;
  requestedTime?: string;
  priceCents?: number;
  surcharge?: boolean;
};

export type Proposal = {
  id: string;
  requestId: string;
  date: string;
  time: string;
  note: string;
  status: ProposalStatus;
};

export type AppointmentOutcome = "completed" | "no_show" | "cancelled";

export type AppointmentStatus = "confirmed" | "cancelled";

export type Appointment = {
  id: string;
  requestId: string | null;
  clientId: string | null;
  /** Walk-in name when the booking has no registered client (barber-created). */
  clientName?: string;
  serviceId: string;
  date: string;
  time: string;
  /** Duration captured by the appointment's stored start/end instants. */
  durationMinutes?: number;
  /** Agreed booking price captured in cents, independent of today's catalog. */
  priceCents?: number | null;
  note?: string | null;
  /**
   * `cancelled` rows keep the slot's history (outcome analytics) but must never
   * render as booked. Operational loaders return confirmed rows only.
   */
  status: AppointmentStatus;
  outcome?: AppointmentOutcome | null;
};

/** Half-open UTC range [start, end) during which the barber is unavailable. */
export type BlockedInterval = {
  start: string;
  end: string;
  /** Barber's short note; only admin loaders include it, never client payloads. */
  reason?: string | null;
};

/** Shop-local dates and optional wall times for a human-readable closure. */
export type BlockedRange = {
  id: string;
  start: string;
  end: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type Notification = {
  id: string;
  channel: NotificationChannel;
  to: string;
  subject: string;
  body?: string | null;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
};

// A client's own upcoming confirmed appointment, with the pre-computed 24h
// lead-time flag that gates self-service cancel/reschedule.
export type ClientAppointment = {
  id: string;
  serviceId: string;
  date: string;
  time: string;
  /** True when the appointment starts more than 24h from now. */
  canModify: boolean;
};

export type ConfirmedRequestSlot = { requestId: string; date: string; time: string };

export type AppState = {
  services: Service[];
  clients: ClientProfile[];
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  notifications: Notification[];
};

// 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
export type BusinessHoursDay = {
  weekday: number;
  opensAt: string;   // "HH:MM"
  closesAt: string;  // "HH:MM"
  closed: boolean;
};

export type AvailabilityDay = {
  date: string;
  capacity: number;
  booked: number;
  proposed: number;
  available: number;
  blocked: boolean;
};
