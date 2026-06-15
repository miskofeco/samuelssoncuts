import { redirect } from "next/navigation";

import { CompletePhoneForm } from "@/components/auth/complete-phone-form";
import { Card } from "@/components/shared/card";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
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
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-7">
        <Logo className="h-10" priority />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-black dark:text-white">
          {t.auth.completeProfileTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {t.auth.completeProfileSubtitle}
        </p>
        <div className="mt-5">
          <CompletePhoneForm />
        </div>
      </Card>
    </main>
  );
}
