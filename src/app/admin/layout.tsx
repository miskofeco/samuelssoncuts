import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/server/auth";
import { loadAttentionCounts } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();
  // Server-computed sidebar badge counts. They refresh via revalidatePath()
  // whenever an admin action changes a request/approval, so the badge stays
  // correct without a manual reload.
  const attention = await loadAttentionCounts();

  return (
    <AppShell role="admin" profile={profile} attention={attention}>
      {children}
    </AppShell>
  );
}
