import { ClientDirectory } from "@/components/admin/client-directory";
import { requireAdmin } from "@/server/auth";
import { getDict } from "@/i18n/server";
import { loadClients } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdmin();
  const [clients, t] = await Promise.all([loadClients(), getDict()]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t.nav.clients}</h1>
      <ClientDirectory clients={clients} />
    </div>
  );
}
