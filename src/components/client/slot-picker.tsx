"use client";

import {
  Calendar03Icon,
  Cancel01Icon,
  Clock01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { localDateToIso } from "@/components/shared/date-field";
import { Icon } from "@/components/shared/icon";
import { ScheduleCalendar } from "@/components/shared/schedule-calendar";
import {
  clientSlotsForService,
  isDateInClientBookingWindow,
  isDateClosedForBusinessHours,
  isStartInClientBookingWindow,
  isStartInFuture,
  isPreferredClientStart,
  latestClientBookingDate,
  minutesOf,
  monthKey,
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
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
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

// The browser time zone is an external, never-changing value: read it through
// useSyncExternalStore so the server render (null) and the hydrated client
// render stay consistent without a setState-in-effect.
function subscribeNoop() {
  return () => {};
}
function readBrowserTimeZone(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
}
function readServerTimeZone(): string | null {
  return null;
}

/** Numbered step marker used by the booking stepper (optional). */
export function StepBadge({ step, className }: { step: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums",
        className,
      )}
    >
      {step}
    </span>
  );
}

function PanelTitle({
  step,
  icon,
  children,
  trailing,
}: {
  step?: number;
  icon: typeof Calendar03Icon;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
        {step ? <StepBadge step={step} /> : <Icon icon={icon} className="size-[18px] text-muted-foreground" />}
        <span className="truncate">{children}</span>
      </p>
      {trailing ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{trailing}</span> : null}
    </div>
  );
}

export function SlotPicker({
  service,
  services,
  pricingSettings,
  date,
  onDateChange,
  selectedTime,
  selectedChoice,
  onSelectTime,
  onInvalidSelection,
  appointments,
  pendingRequests,
  blockedDates,
  businessHours,
  steps,
  aside,
}: {
  service: Service;
  services: Service[];
  pricingSettings: PricingSettings;
  date: string | null;
  onDateChange: (date: string) => void;
  selectedTime: string | null;
  selectedChoice?: SlotChoice | null;
  onSelectTime: (choice: SlotChoice) => void;
  onInvalidSelection?: () => void;
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  businessHours: BusinessHoursDay[];
  /** Step numbers to show next to the date/time panel titles (booking stepper). */
  steps?: { date: number; time: number };
  /**
   * Optional third column (notes, summary, submit). On desktop the card then
   * reads left to right as date → time → confirm, checkout style.
   */
  aside?: ReactNode;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const today = todayIso();
  const latestDate = latestClientBookingDate();
  const shopTimeZone = process.env.NEXT_PUBLIC_SHOP_TIME_ZONE ?? "Europe/Bratislava";
  const browserTimeZone = useSyncExternalStore(subscribeNoop, readBrowserTimeZone, readServerTimeZone);

  const formattedLatestDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${latestDate}T12:00:00`));

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

  useEffect(() => {
    if (!selectedTime || !date) return;
    const current = slots.find((slot) => slot.time === selectedTime);
    if (blockedDates.has(date) || !current) {
      onInvalidSelection?.();
    } else if (selectedChoice &&
      (selectedChoice.price !== current.price || selectedChoice.priceKind !== current.priceKind)) {
      onSelectTime({
        time: current.time,
        surcharge: current.priceKind !== "base",
        price: current.price,
        priceKind: current.priceKind,
      });
    }
  }, [blockedDates, date, onInvalidSelection, onSelectTime, selectedChoice, selectedTime, slots]);

  const isBookable = (iso: string) =>
    isDateInClientBookingWindow(iso) &&
    !blockedDates.has(iso) &&
    !isDateClosedForBusinessHours(iso, businessHours);
  // Days inside the booking window that the barber has closed: painted red so
  // they read as "closed", not as "past". Out-of-window days stay neutral grey.
  const isClosedInWindow = (iso: string) =>
    isDateInClientBookingWindow(iso) &&
    (blockedDates.has(iso) || isDateClosedForBusinessHours(iso, businessHours));

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
      <div
        className={cn(
          "grid lg:divide-x",
          aside
            ? "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)_minmax(0,19rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
        )}
      >
        {/* Date */}
        <section className="p-4 sm:p-5">
          <PanelTitle step={steps?.date} icon={Calendar03Icon}>
            {t.client.pickDate}
          </PanelTitle>
          <ScheduleCalendar
            startMonth={monthKey(today)}
            endMonth={monthKey(latestDate)}
            selected={date}
            onSelect={onDateChange}
            disabled={(day) => !isBookable(localDateToIso(day))}
            modifiers={{ closed: (day) => isClosedInWindow(localDateToIso(day)) }}
            dayClassName={({ modifiers }) =>
              modifiers.closed
                ? "disabled:border-solid disabled:border-red-300 disabled:bg-red-50 disabled:text-red-900 dark:disabled:border-red-500/50 dark:disabled:bg-red-500/15 dark:disabled:text-red-200"
                : undefined
            }
            renderDay={({ modifiers }) =>
              modifiers.closed ? (
                <>
                  <Icon icon={Cancel01Icon} className="size-3 text-red-600 dark:text-red-300" strokeWidth={2.5} />
                  <span className="sr-only">{t.client.unavailable}</span>
                </>
              ) : null
            }
          />
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Icon icon={InformationCircleIcon} className="mt-px size-3.5" />
            <span>{t.client.bookingsOpenUntil(formattedLatestDate)}</span>
          </p>
        </section>

        {/* Times */}
        <section className="flex flex-col border-t p-4 sm:p-5 lg:border-t-0">
          <PanelTitle
            step={steps?.time}
            icon={Clock01Icon}
            trailing={`${service.duration} ${t.admin.minutesShort} · ${service.price} €`}
          >
            {t.client.pickTime}
          </PanelTitle>

          {!date ? (
            <SlotPlaceholder icon={Calendar03Icon}>{t.client.chooseDateFirst}</SlotPlaceholder>
          ) : slots.length === 0 ? (
            <SlotPlaceholder icon={Clock01Icon}>{t.client.noSlotsThatDay}</SlotPlaceholder>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:max-h-[22rem] lg:grid-cols-2 lg:overflow-y-auto lg:pr-1 xl:grid-cols-3">
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
                        "flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition outline-none active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? basePriceSlot
                            ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500 dark:text-white"
                            : vipPriceSlot
                              ? "border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-white"
                            : "border-primary bg-primary text-primary-foreground"
                          : basePriceSlot
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 hover:border-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/15"
                            : vipPriceSlot
                              ? "border-sky-500 bg-sky-50 text-sky-950 hover:border-sky-600 hover:bg-sky-100 dark:border-sky-400/70 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:border-sky-300 dark:hover:bg-sky-500/15"
                            : "bg-card text-foreground hover:border-foreground",
                      )}
                    >
                      <span className="text-sm font-semibold tabular-nums">{slot.time}</span>
                      <span
                        className={cn(
                          "mt-0.5 text-xs font-medium",
                          active
                            ? "opacity-90"
                            : vipPriceSlot
                              ? "rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200"
                              : "text-muted-foreground",
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
                            "mt-0.5 rounded px-1 text-[0.65rem] font-semibold tracking-wide uppercase",
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
              <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground" aria-label={t.client.priceLabel}>
                <LegendChip dotClass="bg-emerald-500">{t.client.bestPrice}</LegendChip>
                <LegendChip dotClass="border border-muted-foreground bg-card">
                  {t.client.extraPrice(pricingSettings.gapSurchargePercent)}
                </LegendChip>
                <LegendChip dotClass="bg-sky-500">
                  {t.client.vipPrice(pricingSettings.vipSurchargePercent)}
                </LegendChip>
                <LegendChip dotClass="bg-amber-400">{t.client.requestedBadge}</LegendChip>
              </ul>
            </>
          )}
          {browserTimeZone && browserTimeZone !== shopTimeZone ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Icon icon={InformationCircleIcon} className="mt-px size-3.5" />
              <span>{t.client.shopTimeZoneHint(shopTimeZone)}</span>
            </p>
          ) : null}
        </section>

        {aside ? (
          <section className="flex flex-col border-t bg-muted/30 p-4 sm:p-5 lg:border-t-0">{aside}</section>
        ) : null}
      </div>
    </div>
  );
}

function SlotPlaceholder({ icon, children }: { icon: typeof Calendar03Icon; children: ReactNode }) {
  // Fills the whole time column so the card keeps its shape before a date is
  // picked, instead of leaving a short box over a large empty area.
  return (
    <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-foreground/10">
        <Icon icon={icon} className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function LegendChip({ dotClass, children }: { dotClass: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 font-medium">
      <span aria-hidden className={cn("size-2 rounded-full", dotClass)} />
      {children}
    </li>
  );
}
