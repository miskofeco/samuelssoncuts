import { RequestForm } from "@/components/client/request-form";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  await requireApprovedClient();
  const data = await loadBookingData();
  const t = await getDict();
  // One-tap rebooking: ?service=<id> preselects that service if it's bookable.
  const { service } = await searchParams;
  const initialServiceId =
    service && data.services.some((s) => s.id === service) ? service : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.client.bookEyebrow}
        title={t.client.bookTitle}
        description={t.client.bookDescription}
      />
      <RequestForm
        services={data.services}
        appointments={data.appointments}
        pendingRequests={data.pendingRequests}
        blockedDates={data.blockedDates}
        initialServiceId={initialServiceId}
      />
    </div>
  );
}
