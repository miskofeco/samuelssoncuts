import type { ReactNode } from "react";

import { Card, SectionHeader } from "@/components/shared/card";

export function ChartCard({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader eyebrow={eyebrow} title={title} action={action} />
      <div className="mt-4 h-64 w-full">{children}</div>
    </Card>
  );
}
