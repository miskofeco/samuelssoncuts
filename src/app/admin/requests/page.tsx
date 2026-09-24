import { RequestQueue } from "@/components/admin/request-queue";
import { requireAdmin } from "@/server/auth";
import { getDict } from "@/i18n/server";
import { loadRequestQueue } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdmin();
  const [data, t] = await Promise.all([loadRequestQueue(), getDict()]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t.nav.requests}</h1>
      <RequestQueue
        requests={data.requests}
        proposals={data.proposals}
        appointments={data.appointments}
        clients={data.clients}
        services={data.services}
        pricingSettings={data.pricingSettings}
        blockedDates={data.blockedDates}
      />
    </div>
  );
}
