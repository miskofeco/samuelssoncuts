import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Storage objects cannot be removed with SQL and an owned object prevents
 * auth.users deletion. Clear this client's avatar folder first, then let one
 * database transaction remove the account and all dependent booking rows.
 */
export async function deleteClientAccount(clientId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const avatars = supabase.storage.from("avatars");
  const { data: objects, error: listError } = await avatars.list(clientId, { limit: 100 });
  if (listError) throw listError;
  if ((objects ?? []).length >= 100) {
    throw new Error("Avatar folder exceeds deletion safety limit");
  }

  const paths = (objects ?? [])
    .filter((object) => object.name && object.id)
    .map((object) => `${clientId}/${object.name}`);
  if (paths.length) {
    const { error: removeError } = await avatars.remove(paths);
    if (removeError) throw removeError;
  }

  const { error: accountError } = await supabase.rpc("delete_client_account", {
    p_client_id: clientId,
  });
  if (accountError) throw accountError;
}
