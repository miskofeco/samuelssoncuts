import { ApprovalQueue } from "@/components/admin/approval-queue";
import { requireAdmin } from "@/server/auth";
import { loadApprovals } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  await requireAdmin();
  const data = await loadApprovals();

  return <ApprovalQueue clients={data.clients} />;
}
