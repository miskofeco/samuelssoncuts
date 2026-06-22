"use client";

import { useMemo } from "react";

import { MonthCalendar } from "@/components/shared/month-calendar";
import {
  contiguousBlockEnd,
  isPreferredStart,
  minutesOf,
  priceForSlot,
  serviceById,
  slotStatusFor,
  slotsForService,
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
    if (!date) return [];
    const blockEnd = contiguousBlockEnd(date, confirmed);
    return slotsForService(service.duration)
      .map((time) => {
        const startMin = minutesOf(time);
        const status = slotStatusFor(date, startMin, service.duration, confirmed, pendingStarts);
        const preferred = isPreferredStart(startMin, blockEnd);
        return {
          time,
          status,
          preferred,
          price: priceForSlot(service.price, preferred),
        };
      })
      // Hide slots taken by a confirmed appointment.
      .filter((s) => s.status !== "taken");
  }, [date, confirmed, pendingStarts, service.duration, service.price]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Date */}
      <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
        <p className="mb-2 text-sm font-semibold text-black dark:text-white">{t.client.pickDate}</p>
        <MonthCalendar
          onDayClick={(cell) => {
            if (!cell.inMonth || cell.date < today || blockedDates.has(cell.date)) return;
            onDateChange(cell.date);
          }}
          dayClassName={(cell) => {
            if (blockedDates.has(cell.date)) {
              return "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15 opacity-60";
            }
            if (cell.date < today) return "opacity-40";
            if (cell.date === date) return "border-black ring-2 ring-black dark:border-white dark:ring-white";
            return "";
          }}
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
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
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
