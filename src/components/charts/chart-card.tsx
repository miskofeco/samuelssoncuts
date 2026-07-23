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
    <Card className="rounded-lg border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.035)] dark:border-white/10 dark:bg-stone-900">
      <SectionHeader eyebrow={eyebrow} title={title} action={action} />
      <div className="mt-6 h-64 w-full">{children}</div>
    </Card>
  );
}
