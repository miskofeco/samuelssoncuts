import { RequestForm } from "@/components/client/request-form";
import { PageHeader } from "@/components/shared/page-header";
import type { AppState } from "@/domain/types";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  await requireApprovedClient();
  const data = await loadBookingData();
  const t = await getDict();

  // PreferencePicker reads availability from an AppState-shaped object.
  const state: AppState = {
    services: data.services,
    clients: [],
    requests: [],
    proposals: data.proposals,
    appointments: data.appointments,
    notifications: [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.client.bookEyebrow}
        title={t.client.bookTitle}
        description={t.client.bookDescription}
      />
      <RequestForm state={state} blockedDates={data.blockedDates} />
    </div>
  );
}
