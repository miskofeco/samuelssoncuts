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
  price: number;
  imageUrl?: string | null;
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
  // computed at booking time and whether the +10% gap surcharge applied.
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

export type Appointment = {
  id: string;
  requestId: string | null;
  clientId: string | null;
  /** Walk-in name when the booking has no registered client (barber-created). */
  clientName?: string;
  serviceId: string;
  date: string;
  time: string;
  outcome?: AppointmentOutcome | null;
};

export type Notification = {
  id: string;
  channel: NotificationChannel;
  to: string;
  subject: string;
  createdAt: string;
};

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
