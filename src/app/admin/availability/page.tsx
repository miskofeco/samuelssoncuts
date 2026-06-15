import { AvailabilityManager } from "@/components/admin/availability-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadBlockedDays } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  await requireAdmin();
  const { ranges, dates } = await loadBlockedDays();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.availabilityEyebrow}
        title={t.admin.availabilityTitle}
        description={t.admin.availabilityDescription}
      />
      <AvailabilityManager ranges={ranges} blockedDates={dates} />
    </div>
  );
}
