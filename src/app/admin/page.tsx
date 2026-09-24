import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminBookingStrip } from "@/components/admin/admin-booking-strip";
import { AdminOverview } from "@/components/admin/admin-overview";
import { todayIso } from "@/domain/schedule";
import { requireAdmin } from "@/server/auth";
import { getDict } from "@/i18n/server";
import { loadAdminOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();
  const [data, t] = await Promise.all([loadAdminOverview(), getDict()]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t.nav.dashboard}</h1>
      <AdminBookingStrip
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
        pricingSettings={data.pricingSettings}
        businessHours={data.businessHours}
        blockedIntervals={data.blockedIntervals}
      />
      <AdminOverview
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
        pricingSettings={data.pricingSettings}
        businessHours={data.businessHours}
        blockedIntervals={data.blockedIntervals}
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
