import type { ComponentProps, ReactNode } from "react";

import {
  Card as UiCard,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/classnames";

export { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

/**
 * Padded surface. Wraps the shadcn Card but renders children in normal flow
 * (no internal grid/gap) so sections can lay themselves out. Padding is
 * tighter on phones and grows from `sm` up; pass `p-0` to opt out.
 */
export function Card({ className, children, ...props }: ComponentProps<typeof UiCard>) {
  return (
    <UiCard
      className={cn("block gap-0 overflow-visible p-4 text-base shadow-xs sm:p-5", className)}
      {...props}
    >
      {children}
    </UiCard>
  );
}

/**
 * Heading row for a card or page section. The action wraps under the title on
 * narrow screens so buttons never get squeezed next to a long heading.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
