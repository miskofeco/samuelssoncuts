// Auth emails (signup confirmation, password recovery, magic link, email change)
// sent via the Supabase "Send Email Hook" so they use our branded EmailLayout
// and go out through Resend from the barber's domain — instead of Supabase's
// built-in plain template. English only: the hook has no access to the user's
// `lang` cookie, matching the other transactional emails.
import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";

// Supabase EmailOtpType values we tailor copy for; anything else falls back to a
// generic "verify" message.
type AuthEmailKind = "signup" | "recovery" | "magiclink" | "email_change" | "email";

const COPY: Record<
  AuthEmailKind,
  { preview: string; heading: string; body: string; cta: string }
> = {
  signup: {
    preview: "Confirm your email to finish signing up",
    heading: "Confirm your email",
    body: "Thanks for registering with Samuelsson Cuts. Confirm your email address to activate your account — the barber will then approve you for booking.",
    cta: "Confirm my email",
  },
  recovery: {
    preview: "Reset your Samuelsson Cuts password",
    heading: "Reset your password",
    body: "We received a request to reset your password. Click below to choose a new one. If you didn't request this, you can safely ignore this email.",
    cta: "Set a new password",
  },
  magiclink: {
    preview: "Your sign-in link for Samuelsson Cuts",
    heading: "Sign in",
    body: "Click below to sign in to your Samuelsson Cuts account. This link works once and expires shortly.",
    cta: "Sign in",
  },
  email_change: {
    preview: "Confirm your new email address",
    heading: "Confirm your new email",
    body: "Confirm this address to finish updating the email on your Samuelsson Cuts account.",
    cta: "Confirm email change",
  },
  email: {
    preview: "Verify your email for Samuelsson Cuts",
    heading: "Verify your email",
    body: "Click below to verify your email address for Samuelsson Cuts.",
    cta: "Verify email",
  },
};

export function AuthEmail({
  kind,
  confirmUrl,
}: {
  kind: string;
  confirmUrl: string;
}) {
  const copy = COPY[(kind as AuthEmailKind)] ?? COPY.email;
  const accent = kind === "recovery" ? "danger" : "brand";

  return (
    <EmailLayout preview={copy.preview} accent={accent}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <EmailParagraph>{copy.body}</EmailParagraph>
      <EmailButton href={confirmUrl} accent={accent}>
        {copy.cta}
      </EmailButton>
      <EmailParagraph>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        <br />
        {confirmUrl}
      </EmailParagraph>
    </EmailLayout>
  );
}
