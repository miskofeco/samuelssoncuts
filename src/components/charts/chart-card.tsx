import type { ReactNode } from "react";

import { Card, SectionHeader } from "@/components/shared/card";
import { cn } from "@/lib/classnames";

/**
 * Consistent frame for every analytics chart: tokenised card surface, a
 * SectionHeader and a fixed-height plot area so charts line up in the grid.
 * Line/bar charts inherit `currentColor` from `text-foreground`.
 */
export function ChartCard({
  eyebrow,
  title,
  description,
  action,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col text-foreground", className)}>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      <div className="mt-5 h-64 w-full min-w-0">{children}</div>
    </Card>
  );
}
