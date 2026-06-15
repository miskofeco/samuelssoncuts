import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-black/10 bg-stone-50 px-6 py-12 text-center dark:border-white/10 dark:bg-stone-900/50",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm dark:bg-stone-800 dark:text-stone-500">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-black dark:text-white">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
