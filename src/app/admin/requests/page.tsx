import { RequestQueue } from "@/components/admin/request-queue";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadRequestQueue } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdmin();
  const data = await loadRequestQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scheduling"
        title="Requests"
        description="Propose times for new requests and re-propose when a client declines."
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
