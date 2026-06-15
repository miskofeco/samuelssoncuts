import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/admin/client-detail";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadClientHistory } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAdmin();
  const { clientId } = await params;
  const data = await loadClientHistory(clientId);
  const t = await getDict();

  if (!data.client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/admin/clients" className="hover:underline">
            {t.admin.allClientsBack}
          </Link>
        }
        title={t.admin.clientProfile}
      />
      <ClientDetail
        client={data.client}
        requests={data.requests}
        proposals={data.proposals}
        appointments={data.appointments}
        services={data.services}
      />
    </div>
  );
}
