import { RequestQueue } from "@/components/admin/request-queue";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadRequestQueue } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdmin();
  const data = await loadRequestQueue();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.requestsEyebrow}
        title={t.admin.requestsTitle}
        description={t.admin.requestsDescription}
      />
      <RequestQueue
        requests={data.requests}
        proposals={data.proposals}
        appointments={data.appointments}
        clients={data.clients}
        services={data.services}
        blockedDates={data.blockedDates}
      />
    </div>
  );
}
