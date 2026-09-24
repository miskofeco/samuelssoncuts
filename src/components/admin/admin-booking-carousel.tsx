"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Clock01Icon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";

import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";
import type { BlockedInterval, BusinessHoursDay } from "@/domain/types";

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

const toneIcon: Record<AdminBookingCarouselItem["tone"], IconSvgElement> = {
  past: TaskDone01Icon,
  current: Clock01Icon,
  future: ArrowRight01Icon,
};

/**
 * One-card-at-a-time snapshot of last / current / next booking. Phones swipe
 * (scroll-snap); the arrow buttons and dots give desktop and keyboard users the
 * same control. Starts centred on the current booking.
 */
export function AdminBookingCarousel({
  items,
  bookedSlots,
  businessHours,
  blockedIntervals,
  positionLabel,
}: {
  items: AdminBookingCarouselItem[];
  bookedSlots: BookedSlotInput[];
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
  positionLabel: string;
}) {
  const t = useT();
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

  function scrollToIndex(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    el.scrollTo({ left: el.clientWidth * clamped, behavior: "smooth" });
  }

  return (
    <div className="mt-4 overflow-hidden">
      <div
        ref={scrollerRef}
        onScroll={updateActiveIndex}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {items.map((item, index) => (
          <BookingSummaryCard
            key={item.key}
            item={item}
            onSelect={setSelected}
            aria-hidden={index !== activeIndex}
            tabIndex={index !== activeIndex ? -1 : undefined}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.common.back}
          disabled={activeIndex <= 0}
          onClick={() => scrollToIndex(activeIndex - 1)}
        >
          <Icon icon={ArrowLeft01Icon} />
        </Button>
        <div aria-label={positionLabel} role="group" className="flex items-center justify-center gap-1">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              aria-label={item.title}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => scrollToIndex(index)}
              className="flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition",
                  index === activeIndex ? "scale-125 bg-foreground" : "bg-foreground/25",
                )}
              />
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.admin.nextBooking}
          disabled={activeIndex >= items.length - 1}
          onClick={() => scrollToIndex(activeIndex + 1)}
        >
          <Icon icon={ArrowRight01Icon} />
        </Button>
      </div>

      <AppointmentDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        bookedByDate={bookedByDate}
        businessHours={businessHours}
        blockedIntervals={blockedIntervals}
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
        // `ring-inset`: an outside ring would bleed 1px from the neighbouring slides into view.
        "w-full shrink-0 snap-center rounded-xl p-4 text-left ring-1 ring-inset transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        booking ? "hover:bg-muted/40 active:bg-muted/60" : "cursor-default",
        tone === "current"
          ? "bg-emerald-500/8 ring-emerald-500/30 dark:bg-emerald-400/10"
          : "bg-card ring-foreground/10",
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase",
            tone === "current" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
          )}
        >
          <Icon icon={toneIcon[tone]} className="size-3.5" strokeWidth={2} />
          {item.title}
        </p>
        {booking?.surcharge ? (
          <StatusPill tone="warning">+{booking.surchargePercent}%</StatusPill>
        ) : null}
      </div>

      {booking ? (
        <div className="mt-3 space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="md" name={booking.clientName} src={booking.clientAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {booking.clientName}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {booking.serviceName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {booking.day}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                {booking.time} · {booking.durationMinutes} {t.admin.minutesShort}
              </p>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {(booking.priceCents / 100).toFixed(2)} €
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 min-h-[3.75rem] text-sm text-muted-foreground">{item.empty}</p>
      )}
    </button>
  );
}
