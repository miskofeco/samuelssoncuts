import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/server/auth";
import { loadAttentionCounts } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-computed sidebar badge counts. They refresh via revalidatePath()
  // whenever an admin action changes a request/approval, so the badge stays
  // correct without a manual reload. RLS scopes the counts, so they can load
  // concurrently with the auth gate.
  const [profile, attention] = await Promise.all([requireAdmin(), loadAttentionCounts()]);

  return (
    <AppShell role="admin" profile={profile} attention={attention}>
      {children}
    </AppShell>
  );
}
