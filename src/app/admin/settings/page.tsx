import { ServiceManager } from "@/components/admin/service-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/shared/profile-form";
import { getDict } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { loadAllServices } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const profile = await requireAdmin();
  const services = await loadAllServices();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.admin.settingsEyebrow}
        title={t.admin.settingsTitle}
        description={t.admin.settingsDescription}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <ServiceManager services={services} />
        <ProfileForm
          fullName={profile.full_name}
          phone={profile.phone ?? ""}
          email={profile.email}
        />
      </div>
    </div>
  );
}
