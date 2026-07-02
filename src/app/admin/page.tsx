import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAdminOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();
  const data = await loadAdminOverview();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.dashboardEyebrow}
        title={t.admin.dashboardTitle}
        description={t.admin.dashboardDescription}
      />
      <AdminOverview
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
      />
      <AdminAnalytics
        appointments={data.appointments}
        requests={data.requests}
        services={data.services}
      />
    </div>
  );
}
