import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";
import { resolveAuthError } from "@/i18n/auth-notices";
import { getDict } from "@/i18n/server";
import { dashboardPathFor, getCurrentProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const [params, t, { configured, profile }] = await Promise.all([searchParams, getDict(), getCurrentProfile()]);

  if (!configured) {
    redirect("/setup");
  }
  if (profile) {
    redirect(dashboardPathFor(profile));
  }

  return (
    <AuthPanel error={resolveAuthError(t, params.error) ?? undefined} mode="register">
      <RegisterForm initialEmail={params.email?.slice(0, 254)} />
      <OAuthButtons intent="register" />
    </AuthPanel>
  );
}
