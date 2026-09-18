import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminBookingStrip } from "@/components/admin/admin-booking-strip";
import { AdminOverview } from "@/components/admin/admin-overview";
import { todayIso } from "@/domain/schedule";
import { requireAdmin } from "@/server/auth";
import { loadAdminOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();
  const data = await loadAdminOverview();

  return (
    <div className="space-y-6">
      <AdminBookingStrip
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
      />
      <AdminOverview
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
      />
      <AdminAnalytics
        appointments={data.appointments}
        analyticsAppointments={data.analyticsAppointments}
        requests={data.requests}
        services={data.services}
        today={todayIso()}
      />
    </div>
  );
}
