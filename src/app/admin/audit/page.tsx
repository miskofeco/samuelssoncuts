import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAuditLog } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  const [entries, t] = await Promise.all([loadAuditLog(), getDict()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.auditEyebrow}
        title={t.admin.auditTitle}
        description={t.admin.auditDescription}
      />

      <Card className="rounded-2xl p-0">
        {entries.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t.admin.auditEmpty} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left dark:border-white/10">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t.admin.auditColWhen}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t.admin.auditColActor}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t.admin.auditColAction}
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:table-cell dark:text-stone-400">
                    {t.admin.auditColTarget}
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 md:table-cell dark:text-stone-400">
                    {t.admin.auditColDetail}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500 dark:text-stone-400">
                      {entry.createdAt}
                    </td>
                    <td className="px-4 py-3 text-stone-700 dark:text-stone-300">{entry.actor}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                        {entry.action}
                      </code>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-500 sm:table-cell dark:text-stone-400">
                      <span className="break-all">{entry.target ?? "—"}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-500 md:table-cell dark:text-stone-400">
                      <span className="break-all">{entry.detail ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
