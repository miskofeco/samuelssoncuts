import { ApprovalQueue } from "@/components/admin/approval-queue";
import { requireAdmin } from "@/server/auth";
import { getDict } from "@/i18n/server";
import { loadApprovals } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  await requireAdmin();
  const [data, t] = await Promise.all([loadApprovals(), getDict()]);

  return <><h1 className="sr-only">{t.nav.approvals}</h1><ApprovalQueue clients={data.clients} /></>;
}
