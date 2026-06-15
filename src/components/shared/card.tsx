import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/classnames";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-black/10 bg-white shadow-[0_18px_70px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-stone-900 dark:shadow-[0_18px_70px_rgba(0,0,0,0.4)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-normal text-black dark:text-white sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
