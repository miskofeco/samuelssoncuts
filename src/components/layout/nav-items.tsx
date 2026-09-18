import {
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarRemove01Icon,
  ClipboardIcon,
  DashboardSquare01Icon,
  InboxIcon,
  Notification03Icon,
  Settings02Icon,
  TaskDone01Icon,
  UserCheck01Icon,
  UserIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type { Dict } from "@/i18n/dictionaries";

// Stable keys into the `nav` dictionary group. The label is resolved at render
// time in the consuming component so it stays localized.
export type NavKey = keyof Dict["nav"];

export type NavItem = {
  href: string;
  key: NavKey;
  icon: IconSvgElement;
  /** Which server-computed attention count badges this item (if any). */
  badge?: "requests" | "approvals" | "unread";
  /**
   * The role's main call to action. On phones it is pinned to the centre of
   * the tab bar and rendered as a raised primary button.
   */
  primary?: boolean;
};

export type NavSection = {
  headingKey?: NavKey;
  items: NavItem[];
};

export const clientNav: NavSection[] = [
  {
    items: [
      { href: "/client", key: "overview", icon: DashboardSquare01Icon },
      { href: "/client/book", key: "bookAppointment", icon: CalendarAdd01Icon, primary: true },
      { href: "/client/reservations", key: "myReservations", icon: TaskDone01Icon },
    ],
  },
  {
    headingKey: "account",
    items: [
      { href: "/client/notifications", key: "notifications", icon: Notification03Icon, badge: "unread" },
      { href: "/client/profile", key: "profile", icon: UserIcon },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    items: [
      { href: "/admin", key: "dashboard", icon: DashboardSquare01Icon },
      { href: "/admin/calendar", key: "calendar", icon: Calendar03Icon, primary: true },
      { href: "/admin/requests", key: "requests", icon: InboxIcon, badge: "requests" },
      { href: "/admin/approvals", key: "approvals", icon: UserCheck01Icon, badge: "approvals" },
    ],
  },
  {
    headingKey: "manage",
    items: [
      { href: "/admin/clients", key: "clients", icon: UserMultiple02Icon },
      { href: "/admin/availability", key: "availability", icon: CalendarRemove01Icon },
      { href: "/admin/audit", key: "auditLog", icon: ClipboardIcon },
      { href: "/admin/settings", key: "settings", icon: Settings02Icon },
    ],
  },
];

/** Items pinned to the phone tab bar (max 4; the rest live under "More"). */
export const MOBILE_TAB_LIMIT = 4;

export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((section) => section.items);
}

/**
 * Order tabs so the `primary` item (if any) sits in the middle slot of the
 * bar. `slotCount` includes a trailing "More" tab when one is rendered, so the
 * primary lands in the visual centre rather than the centre of the pinned
 * items alone. With an even slot count it lands just right of centre.
 */
export function centerPrimaryTab(tabs: NavItem[], slotCount = tabs.length): NavItem[] {
  const index = tabs.findIndex((item) => item.primary);
  if (index === -1) return tabs;
  const rest = tabs.filter((_, i) => i !== index);
  const middle = Math.min(Math.floor(slotCount / 2), rest.length);
  return [...rest.slice(0, middle), tabs[index], ...rest.slice(middle)];
}

export function isNavActive(pathname: string, href: string) {
  // Exact match for index routes, prefix match for sub-sections.
  if (href === "/admin" || href === "/client") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavCounts = {
  requests: number;
  approvals: number;
  unread: number;
};

export function badgeFor(item: NavItem, counts: NavCounts): number {
  if (!item.badge) return 0;
  return counts[item.badge] ?? 0;
}

export function formatBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}
