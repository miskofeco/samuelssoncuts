import { AvailabilityManager } from "@/components/admin/availability-manager";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/server/auth";
import { loadBlockedDays } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  await requireAdmin();
  const { ranges, dates } = await loadBlockedDays();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Availability"
        title="Vacation & blocked days"
        description="Close dates for holidays or time off. Clients can't request appointments on blocked days."
      />
      <AvailabilityManager ranges={ranges} blockedDates={dates} />
    </div>
  );
}
