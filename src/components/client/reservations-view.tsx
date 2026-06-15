"use client";

import { useMemo, useState } from "react";

import { SegmentedControl } from "@/components/shared/segmented-control";
import type { BookingRequest, Proposal, Service } from "@/domain/types";

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
        ariaLabel="Reservation filter"
        value={tab}
        onChange={setTab}
        options={[
          { label: `Active (${active.length})`, value: "active" },
          { label: `History (${history.length})`, value: "history" },
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
