import { Call02Icon, CancelCircleIcon, HourglassIcon, Logout03Icon } from "@hugeicons/core-free-icons";

import { signOutAction } from "@/app/actions";
import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { Button, buttonClass } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { getDict } from "@/i18n/server";
import { getShopPhone } from "@/lib/env";
import { requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await requireProfile();
  const t = await getDict();
  const rejected = profile.approval_status === "rejected";
  const phone = getShopPhone();
  const statusLabel =
    profile.approval_status === "approved"
      ? t.statuses.approved
      : profile.approval_status === "rejected"
        ? t.statuses.rejected
        : t.statuses.approvalPending;

  return (
    <AuthFrame width="lg">
      <AuthHeading
        eyebrow={t.pending.eyebrow}
        title={rejected ? t.pending.notApprovedTitle : t.pending.waitingTitle}
        description={rejected ? t.pending.rejected(profile.full_name) : t.pending.waiting(profile.full_name)}
        illustration={
          <AuthIllustration
            icon={rejected ? CancelCircleIcon : HourglassIcon}
            tone={rejected ? "danger" : "warning"}
          />
        }
        aside={
          <StatusPill tone={rejected ? "danger" : "warning"} dot>
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
    </AuthFrame>
  );
}
