import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/shared/icon";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { ActionResult } from "@/domain/types";
import { cn } from "@/lib/classnames";

import { LocalizedDone } from "./feedback-done";

/** Renders an ActionResult (or a plain error string) as an inline banner. */
export function Feedback({
  result,
  className,
}: {
  result: ActionResult | { ok: false; error: string } | null | undefined;
  className?: string;
}) {
  if (!result) return null;

  const ok = result.ok;
  const text = ok ? (result.message ?? <LocalizedDone />) : result.error;

  return (
    <Alert
      role={ok ? "status" : "alert"}
      variant={ok ? "default" : "destructive"}
      className={cn(
        "items-center border-0",
        ok
          ? "bg-emerald-500/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "bg-destructive/10 dark:bg-destructive/15",
        className,
      )}
    >
      <Icon icon={ok ? CheckmarkCircle02Icon : Alert02Icon} strokeWidth={2} />
      <AlertTitle className="font-medium">{text}</AlertTitle>
    </Alert>
  );
}
