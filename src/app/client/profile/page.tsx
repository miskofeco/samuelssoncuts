import { ProfileForm } from "@/components/shared/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireApprovedClient } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const profile = await requireApprovedClient();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Keep your contact details up to date so the barber can reach you."
      />
      <div className="max-w-xl">
        <ProfileForm
          fullName={profile.full_name}
          phone={profile.phone ?? ""}
          email={profile.email}
        />
      </div>
    </div>
  );
}
