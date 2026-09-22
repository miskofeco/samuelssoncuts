import { AdminCalendar } from "@/components/admin/admin-calendar";
import { getSiteUrl } from "@/lib/env";
import { requireAdmin } from "@/server/auth";
import { adminCalendarWindow, loadAdminCalendar, loadShopCalendarToken } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [, params] = await Promise.all([requireAdmin(), searchParams]);
  // Only the months around the requested date are loaded; navigating the
  // calendar changes the search params and re-renders with a new window.
  const [data, token] = await Promise.all([
    loadAdminCalendar(adminCalendarWindow(params.date ?? "")),
    loadShopCalendarToken(),
  ]);
  const feedUrl = token ? `${getSiteUrl()}/api/calendar/feed/${token}` : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminCalendar
        appointments={data.appointments}
        proposals={data.proposals}
        requests={data.requests}
        clients={data.clients}
        services={data.services}
        blockedDates={data.blockedDates}
        feedUrl={feedUrl}
      />
    </div>
  );
}
