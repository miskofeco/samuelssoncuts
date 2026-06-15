import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireApprovedClient } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const profile = await requireApprovedClient();

  return (
    <AppShell role="client" profile={profile}>
      {children}
    </AppShell>
  );
}
