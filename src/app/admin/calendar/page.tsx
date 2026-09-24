import { AdminCalendar } from "@/components/admin/admin-calendar";
import { getSiteUrl } from "@/lib/env";
import { requireAdmin } from "@/server/auth";
import { getDict } from "@/i18n/server";
import { adminCalendarWindow, loadAdminCalendar, loadShopCalendarToken } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [, params] = await Promise.all([requireAdmin(), searchParams]);
  // Load three months; the client navigates within this range locally and
  // requests a new server window only when the visible dates leave it.
  const calendarWindow = adminCalendarWindow(params.date ?? "");
  const [data, token, t] = await Promise.all([
    loadAdminCalendar(calendarWindow),
    loadShopCalendarToken(),
    getDict(),
  ]);
  const feedUrl = token ? `${getSiteUrl()}/api/calendar/feed/${token}` : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="sr-only">{t.nav.calendar}</h1>
      <AdminCalendar
        appointments={data.appointments}
        proposals={data.proposals}
        requests={data.requests}
        clients={data.clients}
        services={data.services}
        pricingSettings={data.pricingSettings}
        blockedDates={data.blockedDates}
        blockedIntervals={data.blockedIntervals}
        businessHours={data.businessHours}
        calendarWindow={calendarWindow}
        feedUrl={feedUrl}
      />
    </div>
  );
}
