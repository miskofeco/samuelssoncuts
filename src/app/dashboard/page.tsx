import { redirect } from "next/navigation";

import { dashboardPathFor, requireProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  redirect(dashboardPathFor(profile));
}
