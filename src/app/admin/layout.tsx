import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();

  return (
    <AppShell role="admin" profile={profile}>
      {children}
    </AppShell>
  );
}
