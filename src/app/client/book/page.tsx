import { RequestForm } from "@/components/client/request-form";
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
  // One-tap rebooking: ?service=<id> preselects that service if it's bookable.
  const { service } = await searchParams;
  const initialServiceId =
    service && data.services.some((s) => s.id === service) ? service : undefined;

  return (
    <div className="space-y-6">
      <RequestForm
        services={data.services}
        pricingSettings={data.pricingSettings}
        appointments={data.appointments}
        pendingRequests={data.pendingRequests}
        blockedDates={data.blockedDates}
        businessHours={data.businessHours}
        initialServiceId={initialServiceId}
      />
    </div>
  );
}
