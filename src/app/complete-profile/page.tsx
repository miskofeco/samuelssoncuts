import { UserIcon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { CompletePhoneForm } from "@/components/auth/complete-phone-form";
import { getDict } from "@/i18n/server";
import { dashboardPathFor, requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  // requireProfile (unlike requireApprovedClient) does NOT gate on phone, so
  // this page is reachable — no redirect loop.
  const profile = await requireProfile();
  const t = await getDict();

  // Already has a phone (or is the admin): nothing to complete.
  if (profile.role === "admin" || profile.phone?.trim()) {
    redirect(dashboardPathFor(profile));
  }

  return (
    <AuthFrame>
      <AuthHeading
        title={t.auth.completeProfileTitle}
        description={t.auth.completeProfileSubtitle}
        illustration={<AuthIllustration icon={UserIcon} tone="info" />}
      />
      <div className="mt-6">
        <CompletePhoneForm />
      </div>
    </AuthFrame>
  );
}
