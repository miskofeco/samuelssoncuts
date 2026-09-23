import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/admin/client-detail";
import { ButtonLink } from "@/components/shared/button";
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
      <ButtonLink
        href="/admin/clients"
        variant="ghost"
        className="-ml-3 text-muted-foreground hover:text-foreground"
      >
        <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
        {t.admin.allClientsBack}
      </ButtonLink>
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
