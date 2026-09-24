import { UserIcon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { CompletePhoneForm } from "@/components/auth/complete-phone-form";
import { Feedback } from "@/components/shared/feedback";
import { getDict } from "@/i18n/server";
import { dashboardPathFor, requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  // requireProfile (unlike requireApprovedClient) does NOT gate on phone, so
  // this page is reachable — no redirect loop.
  const profile = await requireProfile();
  const [t, { notice }] = await Promise.all([getDict(), searchParams]);
  // Set by /auth/callback when Google was used on the login page: the account
  // was not registered, so this step is the rest of its registration.
  const message = notice === "google_registered"
    ? t.auth.notices.googleRegistered
    : notice === "registration_incomplete"
      ? t.auth.notices.registrationIncomplete
      : null;

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
      {message ? <Feedback result={{ ok: true, message }} className="mt-5" /> : null}
      <div className="mt-6">
        <CompletePhoneForm />
      </div>
    </AuthFrame>
  );
}
