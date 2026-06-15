import { ClientDirectory } from "@/components/admin/client-directory";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadClients } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdmin();
  const clients = await loadClients();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Clients"
        description="Search clients and open a profile to see their full history."
      />
      <ClientDirectory clients={clients} />
    </div>
  );
}
