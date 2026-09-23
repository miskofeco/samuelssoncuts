// Copy for Web Push notifications shown on the phone lock screen.
//
// A push has two visible parts: a short bold title naming the action, and a
// body with the structured details. Everything here is built from structured
// fields only (client name for the barber, service, date, time). Free-text
// client notes and admin reasons never reach the push service.
//
// Push copy is Slovak like the transactional emails; it is not localised per
// recipient because the barber and clients are Slovak-speaking and the push
// service has no access to the viewer's UI locale.

export type PushCopy = {
  title: string;
  body: string;
};

const SEPARATOR = " · ";

// Short Slovak weekday + day/month, e.g. "št 1. 10.". Noon avoids DST edges
// when the ISO date is parsed as local time.
const PUSH_DAY_FORMAT = new Intl.DateTimeFormat("sk-SK", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "št 1. 10. · 15:00" */
export function formatPushWhen(date: string, time: string) {
  return `${PUSH_DAY_FORMAT.format(new Date(`${date}T12:00:00`))}${SEPARATOR}${time}`;
}

function line(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(SEPARATOR);
}

function lines(...rows: Array<string | null | undefined>) {
  return rows.map((row) => row?.trim()).filter(Boolean).join("\n");
}

type Slot = { date: string; time: string };
type ServiceSlot = Slot & { service?: string | null };
type ClientServiceSlot = ServiceSlot & { client: string };

// ─── Barber (admin) pushes ─────────────────────────────────────────────────────

export function adminNewRequestPush(input: ClientServiceSlot): PushCopy {
  return {
    title: "Nová žiadosť o termín",
    body: lines(line(input.client, input.service), formatPushWhen(input.date, input.time)),
  };
}

export function adminRescheduleRequestPush(input: ClientServiceSlot): PushCopy {
  return {
    title: "Žiadosť o presun termínu",
    body: lines(line(input.client, input.service), `Nový čas: ${formatPushWhen(input.date, input.time)}`),
  };
}

export function adminProposalResponsePush(input: ClientServiceSlot & { accepted: boolean }): PushCopy {
  return {
    title: input.accepted ? "Klient potvrdil navrhnutý termín" : "Klient odmietol navrhnutý termín",
    body: lines(line(input.client, input.service), formatPushWhen(input.date, input.time)),
  };
}

export function adminClientCancelledPush(input: ClientServiceSlot): PushCopy {
  return {
    title: "Klient zrušil termín",
    body: lines(line(input.client, input.service), formatPushWhen(input.date, input.time)),
  };
}

// ─── Client pushes ─────────────────────────────────────────────────────────────

export function clientRequestReceivedPush(input: ServiceSlot): PushCopy {
  return {
    title: "Žiadosť o termín prijatá",
    body: lines(line(input.service, formatPushWhen(input.date, input.time)), "Termín bude ešte potvrdený."),
  };
}

export function clientProposedPush(input: ServiceSlot): PushCopy {
  return {
    title: "Návrh nového termínu",
    body: lines(line(input.service, formatPushWhen(input.date, input.time)), "Otvorte rezervácie a odpovedzte."),
  };
}

export function clientConfirmedPush(input: ServiceSlot): PushCopy {
  return {
    title: "Termín potvrdený",
    body: line(input.service, formatPushWhen(input.date, input.time)),
  };
}

export function clientRescheduledPush(input: ServiceSlot): PushCopy {
  return {
    title: "Termín presunutý",
    body: lines(input.service, `Nový čas: ${formatPushWhen(input.date, input.time)}`),
  };
}

export function clientCancelledPush(input: ServiceSlot): PushCopy {
  return {
    title: "Termín zrušený",
    body: lines(line(input.service, formatPushWhen(input.date, input.time)), "Môžete si vybrať nový termín."),
  };
}

export function clientReminderPush(input: ServiceSlot): PushCopy {
  return {
    title: "Zajtra máte termín",
    body: line(input.service, formatPushWhen(input.date, input.time)),
  };
}

export function clientRequestDeclinedPush(): PushCopy {
  return {
    title: "Žiadosť o termín odmietnutá",
    body: "Vyberte si iný termín a odošlite novú žiadosť.",
  };
}

export function clientSlotTakenPush(): PushCopy {
  return {
    title: "Termín už nie je dostupný",
    body: "Požadovaný čas bol medzitým obsadený. Vyberte si iný.",
  };
}

// ─── Account pushes ────────────────────────────────────────────────────────────

export function accountApprovedPush(): PushCopy {
  return {
    title: "Účet schválený",
    body: "Odteraz si môžete rezervovať termín.",
  };
}

export function accountRejectedPush(): PushCopy {
  return {
    title: "Účet nebol schválený",
    body: "Ak ide o omyl, odpovedzte na potvrdzovací email.",
  };
}

export function accountBlockedPush(): PushCopy {
  return {
    title: "Prístup k účtu zrušený",
    body: "Váš prístup k rezerváciám bol zrušený.",
  };
}
