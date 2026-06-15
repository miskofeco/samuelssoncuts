"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/shared/avatar";
import { Card, SectionHeader } from "@/components/shared/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import type { ApprovalStatus, ClientProfile } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";
import { useT } from "@/i18n/provider";

const statusTone: Record<ApprovalStatus, "success" | "warning" | "danger"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

function statusLabel(t: Dict, status: ApprovalStatus) {
  switch (status) {
    case "approved":
      return t.statuses.approved;
    case "pending":
      return t.statuses.approvalPending;
    case "rejected":
      return t.statuses.rejected;
  }
}

export function ClientDirectory({ clients }: { clients: ClientProfile[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const people = useMemo(
    () => clients.filter((client) => client.role !== "admin"),
    [clients],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? people.filter(
          (client) =>
            client.name.toLowerCase().includes(term) ||
            client.email.toLowerCase().includes(term),
        )
      : people;
    const order: Record<ApprovalStatus, number> = { pending: 0, approved: 1, rejected: 2 };
    return [...filtered].sort(
      (a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name),
    );
  }, [people, query]);

  const columns: Column<ClientProfile>[] = [
    {
      key: "name",
      header: t.admin.colClient,
      cell: (client) => (
        <div className="flex items-center gap-3">
          <Avatar name={client.name} size="sm" tone="muted" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-black dark:text-white">{client.name}</p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">{client.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: t.admin.colPhone,
      hideOnMobile: true,
      cell: (client) => client.phone || "—",
    },
    {
      key: "verified",
      header: t.admin.colEmail,
      hideOnMobile: true,
      cell: (client) =>
        client.emailConfirmed ? (
          <StatusPill tone="success">{t.admin.verified}</StatusPill>
        ) : (
          <StatusPill tone="neutral">{t.admin.unverified}</StatusPill>
        ),
    },
    {
      key: "status",
      header: t.admin.colStatus,
      align: "right",
      cell: (client) => (
        <StatusPill tone={statusTone[client.status]}>{statusLabel(t, client.status)}</StatusPill>
      ),
    },
  ];

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.clientsEyebrow}
        title={t.admin.clientsTitle}
        action={<StatusPill tone="neutral">{t.admin.totalCount(people.length)}</StatusPill>}
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t.admin.searchClientsLabel}
        placeholder={t.admin.searchClientsPlaceholder}
        className="mt-4 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-500"
      />
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(client) => client.id}
          onRowClick={(client) => router.push(`/admin/clients/${client.id}`)}
          empty={<EmptyState title={t.admin.noClientsFound} description={t.admin.nothingMatches(query)} />}
        />
      </div>
    </Card>
  );
}
