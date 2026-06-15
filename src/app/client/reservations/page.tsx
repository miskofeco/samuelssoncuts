import { ReservationsView } from "@/components/client/reservations-view";
import { ButtonLink } from "@/components/shared/button";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";
import { loadClientReservations } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const profile = await requireApprovedClient();
  const data = await loadClientReservations(profile);
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.client.reservationsEyebrow}
        title={t.client.reservationsTitle}
        description={t.client.reservationsDescription}
        actions={<ButtonLink href="/client/book">{t.client.newRequest}</ButtonLink>}
      />
      <ReservationsView
        requests={data.requests}
        proposals={data.proposals}
        services={data.services}
      />
    </div>
  );
}
