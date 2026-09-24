// Sent the day before a confirmed appointment, or on the appointment day when
// yesterday's delivery failed or a booking was confirmed after the daily run.
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function AppointmentReminderEmail({
  clientName,
  service,
  date,
  time,
  relativeDay = "tomorrow",
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  relativeDay?: "today" | "tomorrow";
}) {
  const formattedDate = formatEmailDate(date);
  const dayLabel = relativeDay === "today" ? "dnes" : "zajtra";

  return (
    <EmailLayout preview={`Pripomienka: termín ${dayLabel} o ${time}`}>
      <EmailHeading icon="notification">Pripomienka termínu</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Pripomíname váš termín, ktorý máte naplánovaný na {dayLabel}.
      </EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        Zobraziť rezervácie
      </EmailButton>
    </EmailLayout>
  );
}
