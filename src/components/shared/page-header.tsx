import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

/**
 * Page title block. Actions sit to the right on wide screens and drop under
 * the title on phones, where they stretch to full width for easy tapping.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[0.9375rem]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 *:flex-1 sm:*:flex-none">{actions}</div>
      ) : null}
    </div>
  );
}
