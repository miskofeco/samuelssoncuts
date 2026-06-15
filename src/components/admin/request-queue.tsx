"use client";

import { useMemo, useState } from "react";

import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { cn } from "@/lib/classnames";

import { ProposalComposer } from "./proposal-form";

type FilterKey = "actionable" | "pending" | "proposed" | "confirmed" | "all";

const filters: { key: FilterKey; label: string }[] = [
  { key: "actionable", label: "Needs action" },
  { key: "pending", label: "New" },
  { key: "proposed", label: "Awaiting client" },
  { key: "confirmed", label: "Confirmed" },
  { key: "all", label: "All" },
];

function matches(status: RequestStatus, filter: FilterKey) {
  switch (filter) {
    case "actionable":
      return status === "pending" || status === "declined";
    case "pending":
      return status === "pending";
    case "proposed":
      return status === "proposed";
    case "confirmed":
      return status === "confirmed";
    case "all":
      return true;
  }
}

export function RequestQueue({
  requests,
  proposals,
  appointments,
  clients,
  services,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  clients: ClientProfile[];
  services: Service[];
}) {
  const [filter, setFilter] = useState<FilterKey>("actionable");

  const counts = useMemo(() => {
    const tally = (key: FilterKey) =>
      requests.filter((request) => matches(request.status, key)).length;
    return {
      actionable: tally("actionable"),
      pending: tally("pending"),
      proposed: tally("proposed"),
      confirmed: tally("confirmed"),
      all: requests.length,
    } satisfies Record<FilterKey, number>;
  }, [requests]);

  const visible = useMemo(
    () =>
      [...requests]
        .filter((request) => matches(request.status, filter))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [requests, filter],
  );

  return (
    <Card className="flex h-full flex-col rounded-2xl p-5">
      <SectionHeader
        eyebrow="Scheduling"
        title="Appointment requests"
        action={
          <StatusPill tone={counts.actionable > 0 ? "info" : "neutral"}>
            {counts.actionable} to handle
          </StatusPill>
        }
      />

      <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                    : "bg-white text-stone-500 dark:bg-stone-900 dark:text-stone-400",
                )}
              >
                {counts[item.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <EmptyState title="Nothing here right now" description="Requests will appear as clients book." />
        ) : (
          visible.map((request) => (
            <ProposalComposer
              key={request.id}
              client={clients.find((item) => item.id === request.clientId)}
              appointments={appointments}
              request={request}
              services={services}
              activeProposal={proposals.find((item) => item.id === request.proposalId)}
            />
          ))
        )}
      </div>
    </Card>
  );
}
