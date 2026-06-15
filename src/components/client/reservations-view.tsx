"use client";

import { useMemo, useState } from "react";

import { SegmentedControl } from "@/components/shared/segmented-control";
import type { BookingRequest, Proposal, Service } from "@/domain/types";
import { useT } from "@/i18n/provider";

import { ReservationList } from "./reservation-list";

type Tab = "active" | "history";

export function ReservationsView({
  requests,
  proposals,
  services,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  services: Service[];
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("active");

  const { active, history } = useMemo(() => {
    const isActive = (r: BookingRequest) =>
      r.status === "pending" || r.status === "proposed";
    return {
      active: requests.filter(isActive),
      history: requests.filter((r) => !isActive(r)),
    };
  }, [requests]);

  const shown = tab === "active" ? active : history;

  return (
    <div className="space-y-4">
      <SegmentedControl
        ariaLabel={t.client.reservationFilter}
        value={tab}
        onChange={setTab}
        options={[
          { label: t.client.active(active.length), value: "active" },
          { label: t.client.history(history.length), value: "history" },
        ]}
      />
      <ReservationList
        requests={shown}
        proposals={proposals}
        services={services}
        variant={tab}
      />
    </div>
  );
}
