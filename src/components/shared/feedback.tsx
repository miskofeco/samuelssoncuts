import type { ActionResult } from "@/domain/types";
import { cn } from "@/lib/classnames";

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
  const text = ok ? (result.message ?? "Done.") : result.error;

  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium",
        ok
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
        className,
      )}
    >
      {text}
    </p>
  );
}
