"use client";

import { useMemo } from "react";

import { MonthCalendar } from "@/components/shared/month-calendar";
import {
  clientSlotsForService,
  isDateInClientBookingWindow,
  isDateClosedForBusinessHours,
  isStartInClientBookingWindow,
  isStartInFuture,
  isPreferredClientStart,
  latestClientBookingDate,
  minutesOf,
  priceKindForSlot,
  priceForSlot,
  serviceById,
  slotStatusFor,
  todayIso,
} from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  BusinessHoursDay,
  PricingSettings,
  Service,
} from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";
import { zonedDateTimeToUtcIso } from "@/lib/time-zone";

export type SlotChoice = {
  time: string;
  surcharge: boolean;
  price: number;
  priceKind: "base" | "gap" | "vip";
};

// Confirmed appointments carry only serviceId; resolve duration from services.
function apptDuration(appt: Appointment, services: Service[]): number {
  return serviceById(appt.serviceId, services).duration;
}

export function SlotPicker({
  service,
  services,
  pricingSettings,
  date,
  onDateChange,
  selectedTime,
  onSelectTime,
  appointments,
  pendingRequests,
  blockedDates,
  businessHours,
}: {
  service: Service;
  services: Service[];
  pricingSettings: PricingSettings;
  date: string | null;
  onDateChange: (date: string) => void;
  selectedTime: string | null;
  onSelectTime: (choice: SlotChoice) => void;
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  businessHours: BusinessHoursDay[];
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
    if (!date || !isDateInClientBookingWindow(date)) return [];
    return clientSlotsForService(date, service.duration, confirmed, businessHours)
      .map((time) => {
        const startMin = minutesOf(time);
        const status = slotStatusFor(date, startMin, service.duration, confirmed, pendingStarts);
        const preferred = isPreferredClientStart(date, startMin, service.duration, confirmed, businessHours);
        const priceKind = priceKindForSlot(preferred, { startsAt: time });
        return {
          time,
          status,
          preferred,
          priceKind,
          price: priceForSlot(service.price, preferred, {
            startsAt: time,
            ...pricingSettings,
          }),
        };
      })
      // Hide slots taken by a confirmed appointment.
      .filter((s) => {
        const start = zonedDateTimeToUtcIso(date, s.time);
        return s.status !== "taken" && isStartInFuture(start) && isStartInClientBookingWindow(start);
      });
  }, [businessHours, date, confirmed, pendingStarts, pricingSettings, service.duration, service.price]);

  return (
    <div className="grid gap-6 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Date */}
      <div className="px-4 sm:rounded-xl sm:border sm:border-black/10 sm:p-3 sm:dark:border-white/10">
        <p className="mb-2 text-sm font-semibold text-black dark:text-white">
          {t.client.pickDate}
        </p>
        <MonthCalendar
          onDayClick={(cell) => {
            const closedForBusinessHours = isDateClosedForBusinessHours(cell.date, businessHours);
            if (
              !isDateInClientBookingWindow(cell.date) ||
              cell.date < today ||
              cell.date > latestDate ||
              blockedDates.has(cell.date) ||
              closedForBusinessHours
            ) return;
            onDateChange(cell.date);
          }}
          dayClassName={(cell) => {
            const closedForBusinessHours = isDateClosedForBusinessHours(cell.date, businessHours);
            const outOfWindow =
              !isDateInClientBookingWindow(cell.date) ||
              cell.date < today ||
              cell.date > latestDate;
            if (outOfWindow) {
              return "cursor-not-allowed border-dashed !border-stone-400 !bg-stone-200 text-stone-500 dark:!border-stone-700 dark:!bg-stone-800 dark:text-stone-500";
            }
            if (blockedDates.has(cell.date) || closedForBusinessHours) {
              return "cursor-not-allowed border-2 border-red-300 bg-red-50 opacity-70 dark:border-red-500/60 dark:bg-red-500/15";
            }
            if (cell.date === date) return "!border-emerald-500 ring-2 ring-emerald-500 dark:!border-emerald-400 dark:ring-emerald-400";
            return "";
          }}
          dayNumberClassName={(cell) =>
            !isDateInClientBookingWindow(cell.date) || cell.date < today || cell.date > latestDate
              || isDateClosedForBusinessHours(cell.date, businessHours)
              ? "text-stone-400 dark:text-stone-500"
              : ""
          }
          renderDay={(cell) => {
            const unavailable =
              blockedDates.has(cell.date) || isDateClosedForBusinessHours(cell.date, businessHours);
            const disabledForBookingMarker =
              !isDateInClientBookingWindow(cell.date) ||
              cell.date < today ||
              cell.date > latestDate;
            return unavailable && !disabledForBookingMarker ? (
              <span
                aria-label={t.client.unavailable}
                className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 dark:bg-red-500/20 dark:text-red-200"
              >
                <span aria-hidden="true">x</span>
                <span className="sr-only">{t.client.unavailable}</span>
              </span>
            ) : null;
          }}
        />
      </div>

      {/* Times */}
      <div className="px-4 sm:rounded-xl sm:border sm:border-black/10 sm:p-3 sm:dark:border-white/10">
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
                const basePriceSlot = slot.preferred && slot.priceKind === "base";
                const vipPriceSlot = slot.priceKind === "vip";
                return (
                  <button
                    key={slot.time}
                    type="button"
                    aria-pressed={active}
                    aria-label={
                      slot.status === "requested"
                        ? `${slot.time} — ${t.client.requestedHint}`
                        : slot.time
                    }
                    onClick={() =>
                      onSelectTime({
                        time: slot.time,
                        surcharge: slot.priceKind !== "base",
                        price: slot.price,
                        priceKind: slot.priceKind,
                      })
                    }
                    title={slot.status === "requested" ? t.client.requestedHint : undefined}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition",
                      active
                        ? basePriceSlot
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-white"
                          : vipPriceSlot
                            ? "border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-white"
                          : "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : basePriceSlot
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 hover:border-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/15"
                          : vipPriceSlot
                            ? "border-sky-500 bg-sky-50 text-sky-950 hover:border-sky-600 hover:bg-sky-100 dark:border-sky-400/70 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:border-sky-300 dark:hover:bg-sky-500/15"
                          : "border-black/10 bg-white hover:border-black dark:border-white/10 dark:bg-stone-900 dark:hover:border-white",
                    )}
                  >
                    <span className="text-sm font-semibold tabular-nums">{slot.time}</span>
                    <span
                      className={cn(
                        "mt-0.5 text-[0.6rem] font-medium",
                        active
                          ? "opacity-90"
                          : vipPriceSlot
                            ? "rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200"
                            : "text-stone-500 dark:text-stone-400",
                      )}
                    >
                      {slot.priceKind === "base"
                        ? t.client.bestPrice
                        : slot.priceKind === "vip"
                          ? t.client.vipPrice(pricingSettings.vipSurchargePercent)
                          : t.client.extraPrice(pricingSettings.gapSurchargePercent)}
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
                <span className="h-2 w-2 rounded-full bg-amber-500" />{" "}
                {t.client.extraPrice(pricingSettings.gapSurchargePercent)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />{" "}
                {t.client.vipPrice(pricingSettings.vipSurchargePercent)}
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
