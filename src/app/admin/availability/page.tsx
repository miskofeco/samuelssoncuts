import { AvailabilityManager } from "@/components/admin/availability-manager";
import { BusinessHoursEditor } from "@/components/admin/business-hours-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadBlockedDays, loadBusinessHours } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  const admin = await requireAdmin();
  const [{ ranges, dates }, businessHours, lang, t] = await Promise.all([
    loadBlockedDays(),
    loadBusinessHours(admin.id),
    getLang(),
    getDict(),
  ]);

  return (
    <Tabs defaultValue="hours" className="gap-4 sm:gap-6">
      <TabsList className="w-full sm:w-auto sm:min-w-96">
        <TabsTrigger value="hours" className="text-sm">
          {t.admin.availabilityTabHours}
        </TabsTrigger>
        <TabsTrigger value="blocked" className="text-sm">
          {t.admin.availabilityTabBlockedDays}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hours">
        <BusinessHoursEditor initialHours={businessHours} locale={localeFor(lang)} />
      </TabsContent>

      <TabsContent value="blocked">
        <AvailabilityManager ranges={ranges} blockedDates={dates} />
      </TabsContent>
    </Tabs>
  );
}
