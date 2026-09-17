import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <Empty className={cn("border border-dashed bg-muted/30 py-10", className)}>
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon" className="size-11 rounded-xl bg-card text-muted-foreground shadow-xs ring-1 ring-foreground/10 [&_svg:not([class*='size-'])]:size-5">
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent className="*:w-full sm:*:w-auto">{action}</EmptyContent> : null}
    </Empty>
  );
}
