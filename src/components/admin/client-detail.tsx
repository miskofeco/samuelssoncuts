import { Avatar } from "@/components/shared/avatar";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";

import { requestStatusMeta } from "@/components/client/status-meta";

const statusTone = { approved: "success", pending: "warning", rejected: "danger" } as const;

export function ClientDetail({
  client,
  requests,
  proposals,
  appointments,
  services,
}: {
  client: ClientProfile;
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
}) {
  const today = todayIso();
  const upcoming = appointments.filter((a) => a.date >= today).length;
  const totalSpend = appointments.reduce(
    (sum, appointment) => sum + serviceById(appointment.serviceId, services).price,
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} size="lg" />
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white">{client.name}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">{client.email}</p>
              {client.phone ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">{client.phone}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={statusTone[client.status]}>{client.status}</StatusPill>
            <StatusPill tone={client.emailConfirmed ? "success" : "neutral"}>
              {client.emailConfirmed ? "Email verified" : "Email unverified"}
            </StatusPill>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total visits" value={appointments.length} />
        <StatCard label="Upcoming" value={upcoming} tone={upcoming > 0 ? "emerald" : "neutral"} />
        <StatCard label="Requests" value={requests.length} />
        <StatCard label="Lifetime value" value={`$${totalSpend}`} hint="Confirmed visits" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <SectionHeader title="Appointments" />
          <div className="mt-4 space-y-2">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments yet" />
            ) : (
              [...appointments]
                .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                  >
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {serviceById(appointment.serviceId, services).name}
                    </p>
                    <p className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
                      {formatFullDay(appointment.date)} · {appointment.time}
                    </p>
                  </div>
                ))
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title="Request history" />
          <div className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <EmptyState title="No requests yet" />
            ) : (
              [...requests]
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((request) => {
                  const meta = requestStatusMeta[request.status];
                  const proposal = proposals.find((p) => p.id === request.proposalId);
                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-black dark:text-white">
                          {serviceById(request.serviceId, services).name}
                        </p>
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {proposal
                          ? `Proposed ${formatFullDay(proposal.date)} at ${proposal.time}`
                          : request.preferences
                              .map((preference) => formatFullDay(preference.date))
                              .join(", ")}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
