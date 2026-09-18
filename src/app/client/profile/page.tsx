import { OpenPreferencesCard } from "@/components/consent/open-preferences-button";
import { PrivacyControls } from "@/components/client/privacy-controls";
import { ProfileForm } from "@/components/shared/profile-form";
import { requireApprovedClient } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const profile = await requireApprovedClient();

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-4 sm:space-y-6">
        <ProfileForm
          fullName={profile.full_name}
          phone={profile.phone ?? ""}
          email={profile.email}
          avatarUrl={profile.avatar_url}
        />
        <OpenPreferencesCard />
        <PrivacyControls />
      </div>
    </div>
  );
}
