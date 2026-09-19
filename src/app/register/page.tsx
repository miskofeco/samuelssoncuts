import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";
import { dashboardPathFor, getCurrentProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const [params, { configured, profile }] = await Promise.all([searchParams, getCurrentProfile()]);

  if (!configured) {
    redirect("/setup");
  }
  if (profile) {
    redirect(dashboardPathFor(profile));
  }

  return (
    <AuthPanel mode="register">
      <RegisterForm initialEmail={params.email?.slice(0, 254)} />
      <OAuthButtons />
    </AuthPanel>
  );
}
