import { ApprovalQueue } from "@/components/admin/approval-queue";
import { ApprovalsCalendar } from "@/components/admin/approvals-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadApprovals } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  await requireAdmin();
  const data = await loadApprovals();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.approvalsEyebrow}
        title={t.admin.approvalsTitle}
        description={t.admin.approvalsDescription}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <ApprovalQueue
          clients={data.clients}
          requests={data.requests}
          services={data.services}
        />
        <ApprovalsCalendar clients={data.clients} requests={data.requests} />
      </div>
    </div>
  );
}
