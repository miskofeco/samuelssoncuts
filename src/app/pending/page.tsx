import { Call02Icon, CancelCircleIcon, HourglassIcon, Logout03Icon } from "@hugeicons/core-free-icons";

import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { PrivacyControls } from "@/components/client/privacy-controls";
import { Button, buttonClass } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { getDict } from "@/i18n/server";
import { getShopPhone } from "@/lib/env";
import { dashboardPathFor, requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await requireProfile();
  const t = await getDict();

  // Approved accounts (and phone-less Google sign-ups) do not belong here.
  const destination = dashboardPathFor(profile);
  if (destination !== "/pending") {
    redirect(destination);
  }

  const rejected = profile.approval_status === "rejected";
  const blocked = profile.approval_status === "blocked";
  const closed = rejected || blocked;
  const phone = getShopPhone();
  const statusLabel = rejected
    ? t.statuses.rejected
    : blocked
      ? t.statuses.blocked
      : t.statuses.approvalPending;
  const title = rejected
    ? t.pending.notApprovedTitle
    : blocked
      ? t.pending.blockedTitle
      : t.pending.waitingTitle;
  const description = rejected
    ? t.pending.rejected(profile.full_name)
    : blocked
      ? t.pending.blocked(profile.full_name)
      : t.pending.waiting(profile.full_name);

  return (
    <AuthFrame width="lg">
      <AuthHeading
        eyebrow={t.pending.eyebrow}
        title={title}
        description={description}
        illustration={
          <AuthIllustration
            icon={closed ? CancelCircleIcon : HourglassIcon}
            tone={closed ? "danger" : "warning"}
          />
        }
        aside={
          <StatusPill tone={closed ? "danger" : "warning"} dot>
            {statusLabel}
          </StatusPill>
        }
      />

      {phone ? <p className="mt-5 text-sm text-muted-foreground">{t.pending.contactShop}</p> : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {phone ? (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className={buttonClass("primary", "w-full sm:w-auto", "lg")}>
            <Icon icon={Call02Icon} />
            {phone}
          </a>
        ) : null}
        <form action={signOutAction} className="w-full sm:w-auto">
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <Icon icon={Logout03Icon} />
            {t.common.signOut}
          </Button>
        </form>
      </div>

      {/* A person who was never approved still owns their data: export and
          erasure must not depend on approval. */}
      <div className="mt-6">
        <PrivacyControls />
      </div>
    </AuthFrame>
  );
}
