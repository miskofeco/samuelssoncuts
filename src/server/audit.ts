import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";
import type { Json } from "@/lib/database.types";

// Append an entry to the admin audit log. Best-effort: an audit failure must
// never block or roll back the action the admin just performed, so errors are
// reported to observability and swallowed. The write goes through the
// record_admin_action SECURITY DEFINER RPC, which re-checks is_admin() and
// stamps actor_id server-side (a client cannot forge entries).
export async function recordAdminAction(
  action: string,
  options: {
    targetType?: string;
    targetId?: string;
    detail?: Record<string, Json>;
  } = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_admin_action", {
      p_action: action,
      p_target_type: options.targetType ?? null,
      p_target_id: options.targetId ?? null,
      p_detail: (options.detail ?? {}) as Json,
    });
    if (error) {
      await reportError("audit-log", error, { action, targetId: options.targetId });
    }
  } catch (error) {
    await reportError("audit-log", error, { action, targetId: options.targetId });
  }
}
