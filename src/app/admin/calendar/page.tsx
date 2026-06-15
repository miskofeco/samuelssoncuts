import { AdminCalendar } from "@/components/admin/admin-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { loadAdminCalendar } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const profile = await requireAdmin();
  const data = await loadAdminCalendar();
  const t = await getDict();

  // The admin's secret feed token → live subscription URL.
  const supabase = await createClient();
  const { data: tokenRow } = await supabase
    .from("profiles")
    .select("calendar_token")
    .eq("id", profile.id)
    .single();
  const feedUrl = tokenRow?.calendar_token
    ? `${getSiteUrl()}/api/calendar/feed/${tokenRow.calendar_token}`
    : undefined;

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
        feedUrl={feedUrl}
      />
    </div>
  );
}
