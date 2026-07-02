// Daily "your day" digest sent to the barber each morning alongside the client
// reminders (same 08:00 cron). Lists today's confirmed appointments.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export type AgendaItem = {
  time: string;
  service: string;
  customer: string;
};

export function BarberAgendaEmail({
  date,
  items,
}: {
  date: string;
  items: AgendaItem[];
}) {
  const formattedDate = formatEmailDate(date);
  const count = items.length;

  return (
    <EmailLayout preview={`Your day: ${count} appointment${count === 1 ? "" : "s"}`} accent="brand">
      <EmailHeading>Today&rsquo;s schedule</EmailHeading>
      <EmailParagraph>
        {formattedDate} — you have {count} confirmed appointment{count === 1 ? "" : "s"}.
      </EmailParagraph>
      {count > 0 ? (
        <EmailDetails>
          {items.map((item, index) => (
            <EmailDetail
              key={index}
              label={item.time}
              value={`${item.service} · ${item.customer}`}
            />
          ))}
        </EmailDetails>
      ) : (
        <EmailParagraph>No appointments booked for today. Enjoy the quiet!</EmailParagraph>
      )}
      <EmailButton href={`${getSiteUrl()}/admin/calendar`} accent="brand">
        Open calendar
      </EmailButton>
    </EmailLayout>
  );
}
