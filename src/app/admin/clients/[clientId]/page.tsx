import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/admin/client-detail";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
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
  const [data, t, lang] = await Promise.all([
    loadClientHistory(clientId),
    getDict(),
    getLang(),
  ]);

  if (!data.client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/clients"
            className="inline-flex min-h-8 items-center gap-1 rounded-md text-muted-foreground transition outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2.2} />
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
        locale={localeFor(lang)}
      />
    </div>
  );
}
