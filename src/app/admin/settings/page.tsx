import { ServiceManager } from "@/components/admin/service-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/shared/profile-form";
import { requireAdmin } from "@/server/auth";
import { loadAllServices } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const profile = await requireAdmin();
  const services = await loadAllServices();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Shop settings"
        description="Manage your service catalogue and your own profile."
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
