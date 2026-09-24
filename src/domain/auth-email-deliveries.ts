type AuthEmailHookPayload = {
  user?: { email?: string; new_email?: string };
  email_data?: {
    token_hash?: string;
    token_hash_new?: string;
    email_action_type?: string;
  };
};

export type AuthEmailDelivery = { to: string; tokenHash: string };

// Supabase's email-change hash names are reversed for compatibility:
// token_hash_new confirms the old address, token_hash the new address.
export function authEmailDeliveries(payload: AuthEmailHookPayload): AuthEmailDelivery[] {
  const { user, email_data: data } = payload;
  if (!user || !data) return [];

  if (data.email_action_type === "email_change") {
    if (!user.new_email || !data.token_hash) return [];
    if (data.token_hash_new) {
      if (!user.email) return [];
      return [
        { to: user.email, tokenHash: data.token_hash_new },
        { to: user.new_email, tokenHash: data.token_hash },
      ];
    }
    return [{ to: user.new_email, tokenHash: data.token_hash }];
  }

  return user.email && data.token_hash
    ? [{ to: user.email, tokenHash: data.token_hash }]
    : [];
}
