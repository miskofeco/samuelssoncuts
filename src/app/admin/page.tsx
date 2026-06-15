import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadAdminOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();
  const data = await loadAdminOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Command center"
        description="Approvals, requests, and bookings at a glance."
      />
      <AdminOverview
        clients={data.clients}
        requests={data.requests}
        appointments={data.appointments}
        services={data.services}
      />
      <AdminAnalytics appointments={data.appointments} requests={data.requests} />
    </div>
  );
}
