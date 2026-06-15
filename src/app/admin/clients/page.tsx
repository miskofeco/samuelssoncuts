import { ClientDirectory } from "@/components/admin/client-directory";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadClients } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdmin();
  const clients = await loadClients();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.clientsEyebrow}
        title={t.admin.clientsTitle}
        description={t.admin.clientsDescription}
      />
      <ClientDirectory clients={clients} />
    </div>
  );
}
