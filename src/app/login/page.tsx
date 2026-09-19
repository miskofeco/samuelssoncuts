import { Logout03Icon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { noticeOffersResend, resolveAuthError, resolveAuthNotice } from "@/i18n/auth-notices";
import { getDict } from "@/i18n/server";
import { dashboardPathFor, getCurrentProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; email?: string }>;
}) {
  const [params, t, { configured, authenticated, profile }] = await Promise.all([
    searchParams,
    getDict(),
    getCurrentProfile(),
  ]);

  if (!configured) {
    redirect("/setup");
  }
  // Already signed in: the app decides where this account belongs.
  if (profile) {
    redirect(dashboardPathFor(profile));
  }

  // Signed in but no profile row: signing in again would just loop, so offer
  // the only action that helps (a clean sign-out) instead of the form.
  if (authenticated) {
    return (
      <AuthPanel error={resolveAuthError(t, "profile_missing") ?? undefined} mode="login">
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <Icon icon={Logout03Icon} />
            {t.common.signOut}
          </Button>
        </form>
      </AuthPanel>
    );
  }

  const email = params.email?.slice(0, 254);

  return (
    <AuthPanel
      error={resolveAuthError(t, params.error) ?? undefined}
      message={resolveAuthNotice(t, params.notice, email) ?? undefined}
      mode="login"
    >
      <LoginForm
        initialEmail={email}
        unconfirmedEmail={noticeOffersResend(params.notice) ? email : undefined}
      />
      <OAuthButtons />
    </AuthPanel>
  );
}
