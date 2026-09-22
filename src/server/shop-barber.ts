import "server-only";

import { cache } from "react";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Resolve once per request; never infer the bookable barber from the signed-in
// admin or from whichever business-hours row happens to be returned first.
const getShopBarber = cache(async (): Promise<{ id: string; email: string }> => {
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id, email")
    .eq("is_shop_barber", true)
    .eq("role", "admin")
    .eq("approval_status", "approved")
    .single();

  if (error || !data) throw new Error("Shop barber is not configured");
  return data;
});

export async function getShopBarberId(): Promise<string> {
  return (await getShopBarber()).id;
}

export async function getShopBarberEmail(): Promise<string> {
  return (await getShopBarber()).email;
}
