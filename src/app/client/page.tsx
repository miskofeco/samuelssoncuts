import { ClientOverview } from "@/components/client/client-overview";
import { requireApprovedClient } from "@/server/auth";
import { loadClientOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ClientHomePage() {
  const profile = await requireApprovedClient();
  const data = await loadClientOverview(profile);

  return (
    <div className="space-y-6">
      <ClientOverview
        requests={data.requests}
        proposals={data.proposals}
        appointments={data.appointments}
        services={data.services}
        blockedRanges={data.blockedRanges}
      />
    </div>
  );
}
