import { signOutAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { StatusPill } from "@/components/shared/status-pill";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getDict } from "@/i18n/server";
import { requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await requireProfile();
  const t = await getDict();
  const rejected = profile.approval_status === "rejected";
  const statusLabel =
    profile.approval_status === "approved"
      ? t.statuses.approved
      : profile.approval_status === "rejected"
        ? t.statuses.rejected
        : t.statuses.approvalPending;

  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {t.pending.eyebrow}
          </p>
          <StatusPill tone={rejected ? "danger" : "warning"}>{statusLabel}</StatusPill>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-black dark:text-white">
          {rejected ? t.pending.notApprovedTitle : t.pending.waitingTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {rejected
            ? t.pending.rejected(profile.full_name)
            : t.pending.waiting(profile.full_name)}
        </p>
        <form action={signOutAction} className="mt-5">
          <Button type="submit" variant="secondary">
            {t.common.signOut}
          </Button>
        </form>
      </Card>
    </main>
  );
}
