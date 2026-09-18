import { RequestQueue } from "@/components/admin/request-queue";
import { requireAdmin } from "@/server/auth";
import { loadRequestQueue } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdmin();
  const data = await loadRequestQueue();

  return (
    <div className="space-y-6">
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
