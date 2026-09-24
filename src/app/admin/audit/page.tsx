import { ClipboardIcon, ShieldUserIcon } from "@hugeicons/core-free-icons";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/shared/icon";
import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAuditLog } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

/** Colour an action by its verb so destructive and approving actions stand out. */
function actionTone(action: string): PillTone {
  const verb = action.split(".").pop() ?? action;
  if (/^(delete|block|reject|cancel|decline)$/.test(verb)) return "danger";
  if (/^(approve|confirm|unblock|create)$/.test(verb)) return "success";
  if (/^(propose|reschedule|outcome)$/.test(verb)) return "info";
  return "neutral";
}

export default async function AdminAuditPage() {
  await requireAdmin();
  const [entries, t] = await Promise.all([loadAuditLog(), getDict()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.nav.auditLog}</h1>
      {entries.length === 0 ? (
        <EmptyState title={t.admin.auditEmpty} icon={<Icon icon={ClipboardIcon} />} />
      ) : (
        <Card className="p-0 sm:p-0">
          <p className="border-b px-4 py-3 text-xs text-muted-foreground">{t.admin.auditLatest(100)}</p>

          {/* Phones: one card-like row per entry. */}
          <ul className="divide-y md:hidden">
            {entries.map((entry) => (
              <li key={entry.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <StatusPill tone={actionTone(entry.action)} dot className="font-mono">
                    {entry.action}
                  </StatusPill>
                  <time className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {entry.createdAt}
                  </time>
                </div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Icon icon={ShieldUserIcon} className="text-muted-foreground" />
                  {entry.actor}
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">{entry.target ?? "—"}</p>
                {entry.detail ? (
                  <p className="rounded-lg bg-muted/60 p-2 font-mono text-xs break-all text-foreground/80">
                    {entry.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {/* Desktop: full table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <Th>{t.admin.auditColWhen}</Th>
                  <Th>{t.admin.auditColActor}</Th>
                  <Th>{t.admin.auditColAction}</Th>
                  <Th>{t.admin.auditColTarget}</Th>
                  <Th>{t.admin.auditColDetail}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                      {entry.createdAt}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{entry.actor}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={actionTone(entry.action)} dot className="font-mono">
                        {entry.action}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <span className="break-all">{entry.target ?? "—"}</span>
                    </td>
                    <td className="max-w-md px-4 py-3 font-mono text-xs text-muted-foreground">
                      <span className="break-all">{entry.detail ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </th>
  );
}
