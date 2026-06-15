import { signOutAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { StatusPill } from "@/components/shared/status-pill";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await requireProfile();
  const rejected = profile.approval_status === "rejected";

  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Account status
          </p>
          <StatusPill tone={rejected ? "danger" : "warning"}>
            {profile.approval_status}
          </StatusPill>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-black dark:text-white">
          {rejected ? "Account not approved" : "Waiting for barber approval"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {rejected
            ? `${profile.full_name}, the barber wasn't able to approve your account. Reach out to the shop if you think this is a mistake.`
            : `${profile.full_name}, your registration is complete. Booking access unlocks once the barber approves your account — you'll get an email when it's ready.`}
        </p>
        <form action={signOutAction} className="mt-5">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </main>
  );
}
