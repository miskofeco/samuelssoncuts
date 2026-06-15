import { AdminCalendar } from "@/components/admin/admin-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadAdminCalendar } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await requireAdmin();
  const data = await loadAdminCalendar();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planner"
        title="Calendar"
        description="Confirmed appointments and outstanding proposals across the week and month."
      />
      <AdminCalendar
        appointments={data.appointments}
        proposals={data.proposals}
        requests={data.requests}
        clients={data.clients}
        services={data.services}
        blockedDates={data.blockedDates}
      />
    </div>
  );
}
