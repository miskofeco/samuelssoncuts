"use client";

import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";

import { Avatar } from "@/components/shared/avatar";
import { StatusPill } from "@/components/shared/status-pill";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

import { AppointmentDetailModal } from "./appointment-detail-modal";
import type { BookedSlot, CalendarItem } from "./admin-calendar";

export type BookedSlotInput = BookedSlot & {
  date: string;
};

export type AdminBookingCarouselItem = {
  key: "last" | "current" | "next";
  title: string;
  empty: string;
  booking: {
    clientName: string;
    clientAvatarUrl?: string | null;
    serviceName: string;
    day: string;
    time: string;
    durationMinutes: number;
    priceCents: number;
    surcharge?: boolean;
    surchargePercent?: number;
    calendarItem: CalendarItem;
  } | null;
  tone: "current" | "past" | "future";
};

export function AdminBookingCarousel({
  items,
  bookedSlots,
  positionLabel,
}: {
  items: AdminBookingCarouselItem[];
  bookedSlots: BookedSlotInput[];
  positionLabel: string;
}) {
  const initialIndex = 1;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const bookedByDate = useMemo(() => {
    const map = new Map<string, BookedSlot[]>();
    for (const slot of bookedSlots) {
      const list = map.get(slot.date) ?? [];
      list.push({ id: slot.id, time: slot.time, durationMinutes: slot.durationMinutes });
      map.set(slot.date, list);
    }
    return map;
  }, [bookedSlots]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * initialIndex });
  }, []);

  function updateActiveIndex() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="mt-4 overflow-hidden">
      <div
        ref={scrollerRef}
        onScroll={updateActiveIndex}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2"
      >
        {items.map((item, index) => (
          <BookingSummaryCard
            key={item.key}
            item={item}
            onSelect={setSelected}
            aria-hidden={index !== activeIndex}
          />
        ))}
      </div>
      <div
        aria-label={positionLabel}
        className="mt-2 flex items-center justify-center gap-1.5"
      >
        {items.map((item, index) => (
          <span
            key={item.key}
            className={cn(
              "h-2 w-2 rounded-full transition",
              index === activeIndex
                ? "bg-black dark:bg-white"
                : "bg-stone-300 dark:bg-stone-700",
            )}
          />
        ))}
      </div>
      <AppointmentDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        bookedByDate={bookedByDate}
      />
    </div>
  );
}

function BookingSummaryCard({
  item,
  onSelect,
  ...props
}: {
  item: AdminBookingCarouselItem;
  onSelect: (item: CalendarItem) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) {
  const { booking, tone } = item;
  const t = useT();

  return (
    <button
      type="button"
      disabled={!booking}
      onClick={() => booking?.calendarItem ? onSelect(booking.calendarItem) : undefined}
      className={cn(
        "w-full shrink-0 snap-center rounded-lg border px-4 py-3 text-left transition",
        booking ? "hover:bg-stone-50 dark:hover:bg-stone-800/40" : "cursor-default",
        tone === "current"
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-black/5 bg-white dark:border-white/10 dark:bg-stone-950/40",
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {item.title}
        </p>
        {booking?.surcharge ? (
          <StatusPill tone="warning">+{booking.surchargePercent}%</StatusPill>
        ) : null}
      </div>

      {booking ? (
        <div className="mt-3 space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="sm" name={booking.clientName} src={booking.clientAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-black dark:text-white">
                {booking.clientName}
              </p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {booking.serviceName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {booking.day}
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-stone-800 dark:text-stone-200">
                {booking.time} · {booking.durationMinutes} {t.admin.minutesShort}
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums text-black dark:text-white">
              {Math.round(booking.priceCents / 100)} €
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{item.empty}</p>
      )}
    </button>
  );
}
