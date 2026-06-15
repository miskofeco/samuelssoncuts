import { AdminCalendar } from "@/components/admin/admin-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAdminCalendar } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await requireAdmin();
  const data = await loadAdminCalendar();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.calendarEyebrow}
        title={t.admin.calendarTitle}
        description={t.admin.calendarDescription}
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
