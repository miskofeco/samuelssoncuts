"use client";

import { Card, SectionHeader } from "@/components/shared/card";
import { MonthCalendar } from "@/components/shared/month-calendar";
import type { BookingRequest, ClientProfile } from "@/domain/types";
import { useT } from "@/i18n/provider";

// Shows which days the pending (verified) clients have requested, so the barber
// can eyeball demand before approving.
export function ApprovalsCalendar({
  clients,
  requests,
}: {
  clients: ClientProfile[];
  requests: BookingRequest[];
}) {
  const t = useT();
  const pendingIds = new Set(
    clients
      .filter((c) => c.role !== "admin" && c.status === "pending" && c.emailConfirmed)
      .map((c) => c.id),
  );

  const countByDate = new Map<string, number>();
  for (const request of requests) {
    if (!pendingIds.has(request.clientId)) continue;
    for (const preference of request.preferences) {
      countByDate.set(preference.date, (countByDate.get(preference.date) ?? 0) + 1);
    }
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader eyebrow={t.admin.demandEyebrow} title={t.admin.requestedDays} />
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        {t.admin.requestedDaysDescription}
      </p>
      <div className="mt-4">
        <MonthCalendar
          renderDay={(cell) => {
            const count = countByDate.get(cell.date) ?? 0;
            if (count === 0) return null;
            return (
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                {t.admin.reqCount(count)}
              </span>
            );
          }}
        />
      </div>
    </Card>
  );
}
