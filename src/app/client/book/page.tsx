import { RequestForm } from "@/components/client/request-form";
import { PageHeader } from "@/components/shared/page-header";
import type { AppState } from "@/domain/types";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  await requireApprovedClient();
  const data = await loadBookingData();

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
        eyebrow="Booking"
        title="Book an appointment"
        description="Choose a service and your three preferred days. The barber will propose a matching time."
      />
      <RequestForm state={state} blockedDates={data.blockedDates} />
    </div>
  );
}
