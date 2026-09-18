import { ClientDirectory } from "@/components/admin/client-directory";
import { requireAdmin } from "@/server/auth";
import { loadClients } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdmin();
  const clients = await loadClients();

  return (
    <div className="space-y-6">
      <ClientDirectory clients={clients} />
    </div>
  );
}
