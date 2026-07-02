import type { ReactNode } from "react";

import type { Dict } from "@/i18n/dictionaries";

// Stable keys into the `nav` dictionary group. The label is resolved at render
// time in the consuming component (Sidebar) so it stays localized.
type NavKey = keyof Dict["nav"];

export type NavItem = {
  href: string;
  key: NavKey;
  icon: ReactNode;
};

export type NavSection = {
  headingKey?: NavKey;
  items: NavItem[];
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const Grid = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);
const CalendarPlus = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
  </svg>
);
const ListChecks = () => (
  <svg {...iconProps}>
    <path d="M11 6h10M11 12h10M11 18h10M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
  </svg>
);
const Bell = () => (
  <svg {...iconProps}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const User = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const Calendar = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const UserCheck = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-4 3.5-6 7-6M16 11l2 2 4-4" />
  </svg>
);
const Inbox = () => (
  <svg {...iconProps}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
  </svg>
);
const Users = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-4 3.5-6 7-6s7 2 7 6M17 11a4 4 0 0 0 0-6M22 21c0-3-1.5-4.5-4-5.5" />
  </svg>
);
const CalendarOff = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M9 16l6 0" />
  </svg>
);
const ClipboardList = () => (
  <svg {...iconProps}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M8 11h8M8 16h5" />
  </svg>
);
const Settings = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const clientNav: NavSection[] = [
  {
    items: [
      { href: "/client", key: "overview", icon: <Grid /> },
      { href: "/client/book", key: "bookAppointment", icon: <CalendarPlus /> },
      { href: "/client/reservations", key: "myReservations", icon: <ListChecks /> },
    ],
  },
  {
    headingKey: "account",
    items: [
      { href: "/client/notifications", key: "notifications", icon: <Bell /> },
      { href: "/client/profile", key: "profile", icon: <User /> },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    items: [
      { href: "/admin", key: "dashboard", icon: <Grid /> },
      { href: "/admin/calendar", key: "calendar", icon: <Calendar /> },
      { href: "/admin/requests", key: "requests", icon: <Inbox /> },
      { href: "/admin/approvals", key: "approvals", icon: <UserCheck /> },
    ],
  },
  {
    headingKey: "manage",
    items: [
      { href: "/admin/clients", key: "clients", icon: <Users /> },
      { href: "/admin/availability", key: "availability", icon: <CalendarOff /> },
      { href: "/admin/audit", key: "auditLog", icon: <ClipboardList /> },
      { href: "/admin/settings", key: "settings", icon: <Settings /> },
    ],
  },
];
