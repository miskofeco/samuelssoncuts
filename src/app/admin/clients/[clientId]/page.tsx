import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/admin/client-detail";
import { Icon } from "@/components/shared/icon";
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
      <Link
        href="/admin/clients"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
        {t.admin.allClientsBack}
      </Link>
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
