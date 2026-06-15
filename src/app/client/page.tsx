import { ClientOverview } from "@/components/client/client-overview";
import { PageHeader } from "@/components/shared/page-header";
import { requireApprovedClient } from "@/server/auth";
import { loadClientOverview } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ClientHomePage() {
  const profile = await requireApprovedClient();
  const data = await loadClientOverview(profile);
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client workspace"
        title={`Welcome back, ${firstName}`}
        description="Track your requests and confirmed visits at a glance."
      />
      <ClientOverview
        requests={data.requests}
        proposals={data.proposals}
        appointments={data.appointments}
        services={data.services}
      />
    </div>
  );
}
