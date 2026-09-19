"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/shared/icon";
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

/**
 * Next appointments as tappable rows. Each row opens the shared appointment
 * detail modal; on phones the service moves under the client name so the name
 * keeps readable space next to the date column.
 */
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
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} icon={<Icon icon={Calendar03Icon} />} />
        ) : (
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_10rem] gap-3 border-b px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_10rem]">
              <span>{labels.name}</span>
              <span className="hidden sm:block">{labels.service}</span>
              <span className="text-right">{labels.date}</span>
            </div>
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.calendarItem)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_10rem] min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 text-left transition outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_10rem]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        size="sm"
                        name={item.clientName}
                        src={item.clientAvatarUrl}
                      />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground sm:truncate">
                          {item.clientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground sm:hidden">
                          {item.serviceName}
                        </p>
                      </div>
                    </div>
                    <p className="hidden truncate text-sm text-muted-foreground sm:block">
                      {item.serviceName}
                    </p>
                    <p className="text-right text-sm font-medium tabular-nums text-foreground/80">
                      {item.when}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
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
