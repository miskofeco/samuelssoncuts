// A registration is only actionable for the barber once the account is really
// complete: the email is verified (password sign-ups) and a phone number is on
// file (Google sign-ups arrive without one and add it on /complete-profile).
// Every surface that counts or lists pending approvals must use this rule so
// the queue, the badge and the approve action agree.
export type ApprovalCandidate = {
  emailConfirmed: boolean;
  phone: string | null | undefined;
};

export function isReadyForApproval(candidate: ApprovalCandidate): boolean {
  return candidate.emailConfirmed && Boolean(candidate.phone?.trim());
}
