import type { ReactNode } from "react";

import { Card, SectionHeader } from "@/components/shared/card";
import { cn } from "@/lib/classnames";

/**
 * Consistent frame for every analytics chart: tokenised card surface, a
 * SectionHeader and a fixed-height plot area so charts line up in the grid.
 * Line/bar charts inherit `currentColor` from `text-foreground`.
 */
export function ChartCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col text-foreground", className)}>
      <SectionHeader title={title} description={description} action={action} />
      <div className={cn("mt-5 h-64 w-full min-w-0", contentClassName)}>{children}</div>
    </Card>
  );
}
