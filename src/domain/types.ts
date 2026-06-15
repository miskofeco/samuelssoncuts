export type Role = "client" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected";

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
  duration: number;
  price: number;
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
  preferences: Preference[];
  status: RequestStatus;
  createdAt: string;
  proposalId?: string;
};

export type Proposal = {
  id: string;
  requestId: string;
  date: string;
  time: string;
  note: string;
  status: ProposalStatus;
};

export type Appointment = {
  id: string;
  requestId: string | null;
  clientId: string | null;
  /** Walk-in name when the booking has no registered client (barber-created). */
  clientName?: string;
  serviceId: string;
  date: string;
  time: string;
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

export type AvailabilityDay = {
  date: string;
  capacity: number;
  booked: number;
  proposed: number;
  available: number;
  blocked: boolean;
};
