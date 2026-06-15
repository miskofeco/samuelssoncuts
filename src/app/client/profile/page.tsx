import { ProfileForm } from "@/components/shared/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { getDict } from "@/i18n/server";
import { requireApprovedClient } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const profile = await requireApprovedClient();
  const t = await getDict();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.client.profileEyebrow}
        title={t.client.profileTitle}
        description={t.client.profileDescription}
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
