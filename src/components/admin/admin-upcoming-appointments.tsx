"use client";

import { useMemo, useState } from "react";

import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import type { CalendarItem } from "./admin-calendar";
import { AppointmentDetailModal } from "./appointment-detail-modal";
import type { BookedSlotInput } from "./admin-booking-carousel";
import type { BookedSlot } from "./admin-calendar";

export type AdminUpcomingAppointmentItem = {
  id: string;
  clientName: string;
  clientAvatarUrl?: string | null;
  serviceName: string;
  when: string;
  calendarItem: CalendarItem;
};

export function AdminUpcomingAppointments({
  items,
  bookedSlots,
  emptyTitle,
}: {
  items: AdminUpcomingAppointmentItem[];
  bookedSlots: BookedSlotInput[];
  emptyTitle: string;
}) {
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

  return (
    <>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} />
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.calendarItem)}
              className="flex w-full flex-col items-stretch gap-2 rounded-lg border border-black/5 px-3 py-2.5 text-left transition hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-white/5 dark:hover:bg-stone-800/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  size="sm"
                  name={item.clientName}
                  src={item.clientAvatarUrl}
                />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-black sm:truncate dark:text-white">
                    {item.clientName}
                  </p>
                  <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                    {item.serviceName}
                  </p>
                </div>
              </div>
              <p className="mt-2 pl-11 text-left text-sm font-medium tabular-nums text-stone-600 sm:mt-0 sm:pl-0 sm:text-right dark:text-stone-300">
                {item.when}
              </p>
            </button>
          ))
        )}
      </div>
      <AppointmentDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        bookedByDate={bookedByDate}
      />
    </>
  );
}
