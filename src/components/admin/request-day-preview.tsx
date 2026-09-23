import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/shared/icon";
import { calendarPreviewPlacement, calendarPreviewWindow } from "@/domain/calendar-preview";
import { formatDay, serviceById } from "@/domain/schedule";
import type { Appointment, Service } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";

function hourLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

export function RequestDayPreview({
  appointments,
  date,
  time,
  duration,
  kind,
  services,
  locale,
  t,
}: {
  appointments: Appointment[];
  date: string;
  time: string;
  duration: number;
  kind: "pending" | "proposed";
  services: Service[];
  locale: string;
  t: Dict;
}) {
  const window = calendarPreviewWindow(time, duration);
  const selected = calendarPreviewPlacement(time, duration, window);
  const nearby = appointments
    .filter((appointment) => appointment.date === date && appointment.status === "confirmed")
    .map((appointment) => ({
      appointment,
      placement: calendarPreviewPlacement(
        appointment.time,
        serviceById(appointment.serviceId, services).duration,
        window,
      ),
    }))
    .filter((item) => item.placement !== null);

  return (
    <figure className="hidden min-w-0 border-t border-foreground/10 pt-5 lg:block xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
      <figcaption className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t.admin.requestDayPreview}</p>
          <p className="text-xs text-muted-foreground">{formatDay(date, locale)}</p>
        </div>
        <Link
          href={`/admin/calendar?view=day&date=${encodeURIComponent(date)}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t.admin.viewCalendar}
          <Icon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </figcaption>
      <div className="mt-3 grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-xs font-medium text-muted-foreground">
        <span />
        <span>{t.admin.previewConfirmed}</span>
        <span>{kind === "pending" ? t.admin.previewRequested : t.admin.previewProposed}</span>
      </div>
      <div className="relative mt-1 grid h-32 grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3" role="img" aria-label={t.admin.previewAccessible(time, nearby.length)}>
        <div className="relative">
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ top: `${index * 25}%` }}
            >
              {hourLabel(window.start + index * 60)}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-md bg-emerald-500/5">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="absolute inset-x-0 border-t border-foreground/10" style={{ top: `${index * 25}%` }} />
          ))}
          {nearby.map(({ appointment, placement }) => (
            <span
              key={appointment.id}
              className="absolute inset-x-1 flex items-start overflow-hidden rounded bg-emerald-600 px-1 py-0.5 text-[10px] font-semibold leading-tight text-white tabular-nums"
              style={{ top: `${placement!.top}%`, height: `${placement!.height}%` }}
            >
              {appointment.time}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-md bg-amber-500/5">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="absolute inset-x-0 border-t border-foreground/10" style={{ top: `${index * 25}%` }} />
          ))}
          {selected ? (
            <span
              className="absolute inset-x-1 flex items-start overflow-hidden rounded bg-amber-700 px-1 py-0.5 text-[10px] font-semibold leading-tight text-white tabular-nums"
              style={{ top: `${selected.top}%`, height: `${selected.height}%` }}
            >
              {time}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.admin.previewNotReserved}</p>
    </figure>
  );
}
