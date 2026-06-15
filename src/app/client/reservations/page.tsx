import { ReservationsView } from "@/components/client/reservations-view";
import { ButtonLink } from "@/components/shared/button";
import { PageHeader } from "@/components/shared/page-header";
import { requireApprovedClient } from "@/server/auth";
import { loadClientReservations } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const profile = await requireApprovedClient();
  const data = await loadClientReservations(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reservations"
        title="My reservations"
        description="Respond to proposed times and review your booking history."
        actions={<ButtonLink href="/client/book">New request</ButtonLink>}
      />
      <ReservationsView
        requests={data.requests}
        proposals={data.proposals}
        services={data.services}
      />
    </div>
  );
}
