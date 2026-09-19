import { redirect } from "next/navigation";
import { cache } from "react";

import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthProfile = {
  id: string;
  role: "client" | "admin";
  approval_status: "pending" | "approved" | "rejected" | "blocked";
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
};

// Memoised per request: the layout and the page both gate on the profile, so
// without cache() every navigation paid for two getClaims + two profile reads.
export const getCurrentProfile = cache(async () => {
  if (!getSupabaseEnv()) {
    return { configured: false as const, authenticated: false as const, profile: null };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { configured: true as const, authenticated: false as const, profile: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, approval_status, full_name, email, phone, avatar_url")
    .eq("id", claimsData.claims.sub)
    .single();

  // A session whose profile row is missing (the sign-up trigger failed or the
  // row was deleted) must not loop between /login and /dashboard; callers can
  // tell this apart from "signed out" and offer a sign-out instead.
  if (error || !profile) {
    return { configured: true as const, authenticated: true as const, profile: null };
  }

  return { configured: true as const, authenticated: true as const, profile };
});

export async function requireProfile() {
  const result = await getCurrentProfile();

  if (!result.configured) {
    redirect("/setup");
  }

  if (!result.profile) {
    redirect(result.authenticated ? "/login?error=profile_missing" : "/login");
  }

  return result.profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/client");
  }

  if (profile.approval_status !== "approved") {
    redirect("/pending");
  }

  return profile;
}

export async function requireApprovedClient() {
  const profile = await requireProfile();

  if (profile.role === "admin") {
    redirect("/admin");
  }

  // New sign-ups (esp. Google OAuth) must supply a phone number before anything
  // else. Existing accounts already have one, so they're unaffected.
  if (needsPhone(profile)) {
    redirect("/complete-profile");
  }

  if (profile.approval_status !== "approved") {
    redirect("/pending");
  }

  return profile;
}

// True when a non-admin account has no phone number yet. Admins are exempt so
// the seeded admin is never forced through the completion step.
export function needsPhone(profile: AuthProfile) {
  return profile.role !== "admin" && !profile.phone?.trim();
}

export function dashboardPathFor(profile: AuthProfile) {
  if (profile.role === "admin" && profile.approval_status === "approved") {
    return "/admin";
  }

  if (needsPhone(profile)) {
    return "/complete-profile";
  }

  if (profile.approval_status !== "approved") {
    return "/pending";
  }

  return "/client";
}
