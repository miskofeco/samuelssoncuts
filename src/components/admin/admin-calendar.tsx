"use client";

import { useMemo, useState } from "react";

import { Card, SectionHeader } from "@/components/shared/card";
import { MonthCalendar } from "@/components/shared/month-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import { addDays, formatDay, serviceById, todayIso, workingHours } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";
import { cn } from "@/lib/classnames";

type CalendarItem = {
  id: string;
  title: string;
  service: string;
  time: string;
  type: "Confirmed" | "Proposed";
};

export function AdminCalendar({
  appointments,
  proposals,
  requests,
  clients,
  services,
  blockedDates,
}: {
  appointments: Appointment[];
  proposals: Proposal[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  blockedDates: Set<string>;
}) {
  const [view, setView] = useState<"week" | "month">("week");

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const push = (date: string, item: CalendarItem) => {
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    };

    for (const appointment of appointments) {
      push(appointment.date, {
        id: appointment.id,
        title: clients.find((c) => c.id === appointment.clientId)?.name ?? "Client",
        service: serviceById(appointment.serviceId, services).name,
        time: appointment.time,
        type: "Confirmed",
      });
    }
    for (const proposal of proposals) {
      if (proposal.status !== "sent") continue;
      const request = requests.find((r) => r.id === proposal.requestId);
      const client = clients.find((c) => c.id === request?.clientId);
      push(proposal.date, {
        id: proposal.id,
        title: client?.name ?? "Client",
        service: request ? serviceById(request.serviceId, services).name : "Proposal",
        time: proposal.time,
        type: "Proposed",
      });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [appointments, proposals, requests, clients, services]);

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow="Planner"
        title="Schedule"
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone="success">Confirmed</StatusPill>
            <StatusPill tone="info">Proposed</StatusPill>
          </div>
        }
      />

      <div className="mt-4 max-w-xs">
        <SegmentedControl
          ariaLabel="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
        />
      </div>

      {view === "week" ? (
        <WeekGrid itemsByDate={itemsByDate} />
      ) : (
        <div className="mt-5">
          <MonthCalendar
            renderDay={(cell) => {
              const items = itemsByDate.get(cell.date) ?? [];
              const blocked = blockedDates.has(cell.date);
              if (blocked) {
                return (
                  <span className="mt-1 block rounded bg-stone-200 px-1 py-0.5 text-center text-[0.6rem] font-semibold uppercase text-stone-500 dark:bg-stone-700 dark:text-stone-300">
                    Off
                  </span>
                );
              }
              if (items.length === 0) return null;
              return (
                <span className="mt-1 flex flex-col gap-0.5">
                  {items.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[0.6rem] font-semibold",
                        item.type === "Confirmed"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300",
                      )}
                    >
                      {item.time} {item.title}
                    </span>
                  ))}
                  {items.length > 2 ? (
                    <span className="text-[0.6rem] text-stone-400">+{items.length - 2} more</span>
                  ) : null}
                </span>
              );
            }}
          />
        </div>
      )}
    </Card>
  );
}

function WeekGrid({ itemsByDate }: { itemsByDate: Map<string, CalendarItem[]> }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => addDays(index));
  const rows = workingHours.filter((hour) => hour.endsWith(":00"));

  function itemsFor(date: string, hour: string) {
    return (itemsByDate.get(date) ?? []).filter(
      (item) => item.time.slice(0, 2) === hour.slice(0, 2),
    );
  }

  return (
    <>
      {/* Desktop grid */}
      <div className="mt-5 hidden overflow-x-auto lg:block">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px rounded-t-xl bg-black/5 dark:bg-white/10">
            <div className="bg-white dark:bg-stone-900" />
            {days.map((day) => {
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn(
                    "px-2 py-3 text-center",
                    isToday
                      ? "bg-stone-900 text-white dark:bg-white dark:text-black"
                      : "bg-white dark:bg-stone-900",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "" : "text-black dark:text-white",
                    )}
                  >
                    {formatDay(day)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px bg-black/5 dark:bg-white/10">
            {rows.map((hour) => (
              <CalendarRow key={hour} hour={hour}>
                {days.map((day) => (
                  <div
                    key={`${day}-${hour}`}
                    className={cn(
                      "min-h-[72px] bg-white p-1.5 dark:bg-stone-900",
                      day === today && "bg-stone-50 dark:bg-stone-800/50",
                    )}
                  >
                    {itemsFor(day, hour).map((item) => (
                      <CalendarChip key={item.id} item={item} />
                    ))}
                  </div>
                ))}
              </CalendarRow>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile day list */}
      <div className="mt-5 grid gap-3 lg:hidden">
        {days.map((day) => {
          const items = itemsByDate.get(day) ?? [];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border bg-white p-3 dark:bg-stone-900",
                isToday ? "border-stone-900 dark:border-white" : "border-black/10 dark:border-white/10",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-black dark:text-white">{formatDay(day)}</h3>
                {isToday ? <StatusPill tone="neutral">Today</StatusPill> : null}
              </div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
                    No appointments.
                  </p>
                ) : (
                  items.map((item) => <CalendarChip key={item.id} item={item} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CalendarRow({ hour, children }: { hour: string; children: React.ReactNode }) {
  return (
    <>
      <div className="bg-white px-2 py-3 text-xs font-medium text-stone-400 dark:bg-stone-900 dark:text-stone-500">
        {hour}
      </div>
      {children}
    </>
  );
}

function CalendarChip({ item }: { item: CalendarItem }) {
  return (
    <div
      className={cn(
        "mb-1 rounded-lg px-2 py-1.5 text-xs",
        item.type === "Confirmed"
          ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-200"
          : "bg-sky-100 text-sky-950 dark:bg-sky-500/20 dark:text-sky-200",
      )}
    >
      <p className="font-semibold tabular-nums">
        {item.time} · {item.title}
      </p>
      <p className="truncate opacity-80">{item.service}</p>
    </div>
  );
}
