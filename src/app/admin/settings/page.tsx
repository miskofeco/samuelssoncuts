import { PricingSettingsForm } from "@/components/admin/pricing-settings-form";
import { ServiceManager } from "@/components/admin/service-manager";
import { OpenPreferencesCard } from "@/components/consent/open-preferences-button";
import { ProfileForm } from "@/components/shared/profile-form";
import { PushNotificationCard } from "@/components/shared/push-notification-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAllServices, loadPricingSettings } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const profile = await requireAdmin();
  const [services, pricingSettings] = await Promise.all([
    loadAllServices(),
    loadPricingSettings(),
  ]);
  const t = await getDict();
  // A real catalogue price makes the surcharge preview concrete.
  const exampleBasePrice = (services.find((service) => service.active) ?? services[0])?.price;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t.nav.settings}</h1>
      {/* Tabs keep each area short on phones; Radix handles roving focus. */}
      <Tabs defaultValue="services" className="gap-4 sm:gap-6">
        <TabsList className="w-full sm:w-auto sm:min-w-96">
          <TabsTrigger value="services" className="text-sm">
            {t.admin.settingsTabServices}
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-sm">
            {t.admin.settingsTabProfile}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-sm">
            {t.admin.settingsTabNotifications}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
            <ServiceManager services={services} />
            <PricingSettingsForm initialSettings={pricingSettings} exampleBasePrice={exampleBasePrice} />
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
            <ProfileForm
              fullName={profile.full_name}
              phone={profile.phone ?? ""}
              email={profile.email}
              avatarUrl={profile.avatar_url}
            />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
            <PushNotificationCard />
            <OpenPreferencesCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
