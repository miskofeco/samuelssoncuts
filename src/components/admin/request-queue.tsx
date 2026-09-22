"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/shared/icon";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import { requiresAdminRequestAction } from "@/domain/request-actionability";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { useT } from "@/i18n/provider";

import { ProposalComposer } from "./proposal-form";

type FilterKey = "actionable" | "pending" | "proposed" | "confirmed" | "all";

function matches(status: RequestStatus, filter: FilterKey) {
  switch (filter) {
    case "actionable":
      return requiresAdminRequestAction(status);
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

/**
 * Request inbox: a filter strip (URL-synced) above a flat list of request
 * cards. The list is not nested in a Card so each request gets the full phone
 * width.
 */
export function RequestQueue({
  requests,
  proposals,
  appointments,
  clients,
  services,
  blockedDates,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  clients: ClientProfile[];
  services: Service[];
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const filter: FilterKey =
    filterParam === "pending" ||
    filterParam === "proposed" ||
    filterParam === "confirmed" ||
    filterParam === "all"
      ? filterParam
      : "actionable";

  const filters: { value: FilterKey; label: string }[] = [
    { value: "actionable", label: t.admin.filterActionable },
    { value: "pending", label: t.admin.filterNew },
    { value: "proposed", label: t.admin.filterAwaiting },
    { value: "confirmed", label: t.admin.filterConfirmed },
    { value: "all", label: t.admin.filterAll },
  ];

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

  function setFilter(next: FilterKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "actionable") params.delete("filter");
    else params.set("filter", next);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const visible = useMemo(
    () =>
      [...requests]
        .filter((request) => matches(request.status, filter))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [requests, filter],
  );
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const proposalsById = useMemo(() => new Map(proposals.map((proposal) => [proposal.id, proposal])), [proposals]);

  return (
    <section className="space-y-4">
      <SectionHeader
        title={t.admin.appointmentRequests}
        action={
          <StatusPill tone={counts.actionable > 0 ? "info" : "neutral"} dot={counts.actionable > 0}>
            {t.admin.toHandle(counts.actionable)}
          </StatusPill>
        }
      />

      {/* Filter strip scrolls horizontally on phones instead of wrapping. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 scrollbar-none">
        <SegmentedControl
          ariaLabel={t.admin.appointmentRequests}
          value={filter}
          onChange={setFilter}
          options={filters.map((item) => ({
            ...item,
            count: counts[item.value],
          }))}
          size="sm"
          className="min-w-max"
        />
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <EmptyState
            title={t.admin.nothingHere}
            description={t.admin.nothingHereDescription}
            icon={<Icon icon={InboxIcon} />}
          />
        ) : (
          visible.map((request) => (
            <ProposalComposer
              key={request.id}
              client={clientsById.get(request.clientId)}
              appointments={appointments}
              request={request}
              services={services}
              activeProposal={request.proposalId ? proposalsById.get(request.proposalId) : undefined}
              blockedDates={blockedDates}
            />
          ))
        )}
      </div>
    </section>
  );
}
