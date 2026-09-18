import { ReservationsView } from "@/components/client/reservations-view";
import { UpcomingAppointments } from "@/components/client/upcoming-appointments";
import { ButtonLink } from "@/components/shared/button";
import { CalendarExport } from "@/components/shared/calendar-export";
import { getDict } from "@/i18n/server";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData, loadClientReservations } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const profile = await requireApprovedClient();
  const [data, bookingData] = await Promise.all([
    loadClientReservations(profile),
    loadBookingData(),
  ]);
  const t = await getDict();

  // The client's own secret feed token → subscription URL (their appointments).
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
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
        <CalendarExport feedUrl={feedUrl} />
        <ButtonLink href="/client/book">{t.client.newRequest}</ButtonLink>
      </div>
      <UpcomingAppointments
        appointments={data.upcomingAppointments}
        services={data.services}
        pricingSettings={bookingData.pricingSettings}
        bookedSlots={bookingData.appointments}
        pendingRequests={bookingData.pendingRequests}
        blockedDates={bookingData.blockedDates}
        businessHours={bookingData.businessHours}
      />
      <ReservationsView
        requests={data.requests}
        proposals={data.proposals}
        services={data.services}
      />
    </div>
  );
}
