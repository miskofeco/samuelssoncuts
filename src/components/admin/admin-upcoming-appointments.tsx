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
  labels,
}: {
  items: AdminUpcomingAppointmentItem[];
  bookedSlots: BookedSlotInput[];
  emptyTitle: string;
  labels: {
    name: string;
    service: string;
    date: string;
  };
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
      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} />
        ) : (
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_10rem] gap-4 border-b border-black/5 pb-3 text-sm font-medium text-stone-500 dark:border-white/5 dark:text-stone-400 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_10rem]">
              <span>{labels.name}</span>
              <span className="hidden sm:block">{labels.service}</span>
              <span className="text-right">{labels.date}</span>
            </div>
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.calendarItem)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_10rem] items-center gap-4 py-4 text-left transition hover:bg-stone-50 dark:hover:bg-stone-800/50 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_10rem]"
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
                      <p className="truncate text-xs text-stone-500 sm:hidden dark:text-stone-400">
                        {item.serviceName}
                      </p>
                    </div>
                  </div>
                  <p className="hidden truncate text-sm font-medium text-stone-500 dark:text-stone-400 sm:block">
                    {item.serviceName}
                  </p>
                  <p className="text-right text-sm font-medium tabular-nums text-stone-600 dark:text-stone-300">
                    {item.when}
                  </p>
                </button>
              ))}
            </div>
          </div>
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
