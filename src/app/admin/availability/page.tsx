import { AvailabilityManager } from "@/components/admin/availability-manager";
import { BusinessHoursEditor } from "@/components/admin/business-hours-editor";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { localeFor } from "@/i18n/config";
import { getLang } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadBlockedDays, loadBusinessHours } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  const admin = await requireAdmin();
  const [{ ranges, dates }, businessHours, t, lang] = await Promise.all([
    loadBlockedDays(),
    loadBusinessHours(admin.id),
    getDict(),
    getLang(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.availabilityEyebrow}
        title={t.admin.availabilityTitle}
        description={t.admin.availabilityDescription}
      />
      <BusinessHoursEditor initialHours={businessHours} locale={localeFor(lang)} />
      <AvailabilityManager ranges={ranges} blockedDates={dates} />
    </div>
  );
}
