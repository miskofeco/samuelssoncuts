import { AdminCalendar } from "@/components/admin/admin-calendar";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { loadAdminCalendar } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const profile = await requireAdmin();
  const data = await loadAdminCalendar();

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
    <div className="space-y-4 sm:space-y-6">
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
