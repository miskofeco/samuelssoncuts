import { ApprovalQueue } from "@/components/admin/approval-queue";
import { ApprovalsCalendar } from "@/components/admin/approvals-calendar";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadApprovals } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  await requireAdmin();
  const data = await loadApprovals();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Approvals"
        description="Review clients who verified their email, then approve or reject access."
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
