"use client";

import { useMemo } from "react";

import { MonthCalendar } from "@/components/shared/month-calendar";
import {
  clientSlotsForService,
  isStartInClientBookingWindow,
  isStartInFuture,
  isPreferredClientStart,
  latestClientBookingDate,
  minutesOf,
  priceForSlot,
  serviceById,
  slotStatusFor,
  todayIso,
} from "@/domain/schedule";
import type { Appointment, BookingRequest, Service } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export type SlotChoice = {
  time: string;
  surcharge: boolean;
  price: number;
};

// Confirmed appointments carry only serviceId; resolve duration from services.
function apptDuration(appt: Appointment, services: Service[]): number {
  return serviceById(appt.serviceId, services).duration;
}

export function SlotPicker({
  service,
  services,
  date,
  onDateChange,
  selectedTime,
  onSelectTime,
  appointments,
  pendingRequests,
  blockedDates,
}: {
  service: Service;
  services: Service[];
  date: string | null;
  onDateChange: (date: string) => void;
  selectedTime: string | null;
  onSelectTime: (choice: SlotChoice) => void;
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const today = todayIso();
  const latestDate = latestClientBookingDate();

  // Confirmed appointments shaped for the slot helpers (with resolved duration).
  const confirmed = useMemo(
    () =>
      appointments.map((a) => ({
        date: a.date,
        time: a.time,
        durationMinutes: apptDuration(a, services),
      })),
    [appointments, services],
  );

  // Set of "date T HH:MM" that some client has a pending request for.
  const pendingStarts = useMemo(() => {
    const set = new Set<string>();
    for (const r of pendingRequests) {
      if (r.requestedDate && r.requestedTime) {
        set.add(`${r.requestedDate}T${r.requestedTime}`);
      }
    }
    return set;
  }, [pendingRequests]);

  // All slots for the chosen date with status + price.
  const slots = useMemo(() => {
    if (!date || date < today || date > latestDate) return [];
    return clientSlotsForService(date, service.duration, confirmed)
      .map((time) => {
        const startMin = minutesOf(time);
        const status = slotStatusFor(date, startMin, service.duration, confirmed, pendingStarts);
        const preferred = isPreferredClientStart(date, startMin, service.duration, confirmed);
        return {
          time,
          status,
          preferred,
          price: priceForSlot(service.price, preferred),
        };
      })
      // Hide slots taken by a confirmed appointment.
      .filter((s) => {
        const start = new Date(`${date}T${s.time}:00`).toISOString();
        return s.status !== "taken" && isStartInFuture(start) && isStartInClientBookingWindow(start);
      });
  }, [date, today, latestDate, confirmed, pendingStarts, service.duration, service.price]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Date */}
      <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
        <p className="mb-2 text-sm font-semibold text-black dark:text-white">{t.client.pickDate}</p>
        <MonthCalendar
          onDayClick={(cell) => {
            if (
              cell.date < today ||
              cell.date > latestDate ||
              blockedDates.has(cell.date)
            ) return;
            onDateChange(cell.date);
          }}
          dayClassName={(cell) => {
            const outOfWindow = cell.date < today || cell.date > latestDate;
            if (outOfWindow) {
              return "cursor-not-allowed border-dashed !border-stone-400 !bg-stone-200 text-stone-500 dark:!border-stone-700 dark:!bg-stone-800 dark:text-stone-500";
            }
            if (blockedDates.has(cell.date)) {
              return "cursor-not-allowed border-red-200 bg-red-50 opacity-70 dark:border-red-500/30 dark:bg-red-500/15";
            }
            if (cell.date === date) return "!border-emerald-500 ring-2 ring-emerald-500 dark:!border-emerald-400 dark:ring-emerald-400";
            return "";
          }}
          dayNumberClassName={(cell) =>
            cell.date < today || cell.date > latestDate
              ? "text-stone-400 dark:text-stone-500"
              : ""
          }
        />
      </div>

      {/* Times */}
      <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-black dark:text-white">{t.client.pickTime}</p>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {service.duration} min · {service.price} €
          </span>
        </div>

        {!date ? (
          <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
            {t.client.chooseDateFirst}
          </p>
        ) : slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
            {t.client.noSlotsThatDay}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {slots.map((slot) => {
                const active = slot.time === selectedTime;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() =>
                      onSelectTime({
                        time: slot.time,
                        surcharge: !slot.preferred,
                        price: slot.price,
                      })
                    }
                    title={slot.status === "requested" ? t.client.requestedHint : undefined}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition",
                      active
                        ? slot.preferred
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-white"
                          : "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : slot.preferred
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 hover:border-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/15"
                          : "border-black/10 bg-white hover:border-black dark:border-white/10 dark:bg-stone-900 dark:hover:border-white",
                    )}
                  >
                    <span className="text-sm font-semibold tabular-nums">{slot.time}</span>
                    <span
                      className={cn(
                        "mt-0.5 text-[0.6rem] font-medium",
                        active ? "opacity-80" : "text-stone-500 dark:text-stone-400",
                      )}
                    >
                      {slot.preferred ? t.client.bestPrice : t.client.plus10}
                    </span>
                    {slot.status === "requested" ? (
                      <span
                        className={cn(
                          "mt-0.5 rounded px-1 text-[0.55rem] font-semibold uppercase tracking-wide",
                          active
                            ? "bg-white/20"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
                        )}
                      >
                        {t.client.requestedBadge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-stone-500 dark:text-stone-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t.client.bestPrice}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> {t.client.plus10}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-300" /> {t.client.requestedBadge}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
