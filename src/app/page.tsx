import { redirect } from "next/navigation";

import { dashboardPathFor, getCurrentProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { configured, profile } = await getCurrentProfile();

  if (!configured) {
    redirect("/setup");
  }

  if (!profile) {
    redirect("/login");
  }

  redirect(dashboardPathFor(profile));
}
