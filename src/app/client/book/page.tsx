import { RequestForm } from "@/components/client/request-form";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  await requireApprovedClient();
  const data = await loadBookingData();
  const t = await getDict();

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
      />
    </div>
  );
}
