import { getSiteUrl } from "@/lib/env";

function googleCalendarDate(value: string) {
  const date = new Date(value);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCalendarLinks({
  appointmentId,
  service,
  startIso,
  endIso,
}: {
  appointmentId: string;
  service: string;
  startIso: string;
  endIso: string;
}) {
  const siteUrl = getSiteUrl();
  const title = service ? `Samuelsson Cuts - ${service}` : "Samuelsson Cuts appointment";
  const details = "Confirmed appointment at Samuelsson Cuts.";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleCalendarDate(startIso)}/${googleCalendarDate(endIso)}`,
    details,
  });

  return {
    google: `https://calendar.google.com/calendar/render?${params.toString()}`,
    apple: `${siteUrl}/api/calendar/event/${appointmentId}`,
  };
}
