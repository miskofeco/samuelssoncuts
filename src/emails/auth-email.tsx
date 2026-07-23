// Auth emails sent via the Supabase "Send Email Hook" so they use our branded
// EmailLayout and go out through Resend from the barber's domain.
import { Link, Text } from "@react-email/components";

import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";

// Supabase EmailOtpType values we tailor copy for; anything else falls back to a
// generic "verify" message.
type AuthEmailKind = "signup" | "recovery" | "magiclink" | "email_change" | "email";

const COPY: Record<
  AuthEmailKind,
  { preview: string; heading: string; body: string; cta: string }
> = {
  signup: {
    preview: "Potvrďte email a dokončite registráciu",
    heading: "Potvrďte email",
    body: "Ďakujeme za registráciu v Samuelsson Cuts. Po potvrdení emailu môže byť váš účet schválený na rezervácie.",
    cta: "Potvrdiť email",
  },
  recovery: {
    preview: "Obnova hesla k účtu Samuelsson Cuts",
    heading: "Obnova hesla",
    body: "Prišla žiadosť o obnovu hesla. Cez tlačidlo nižšie si nastavíte nové heslo. Ak ste o zmenu nežiadali, email môžete ignorovať.",
    cta: "Nastaviť nové heslo",
  },
  magiclink: {
    preview: "Prihlasovací odkaz do Samuelsson Cuts",
    heading: "Prihlásenie",
    body: "Cez tlačidlo nižšie sa prihlásite do účtu Samuelsson Cuts. Odkaz funguje iba raz a po krátkom čase vyprší.",
    cta: "Prihlásiť sa",
  },
  email_change: {
    preview: "Potvrďte novú emailovú adresu",
    heading: "Potvrďte nový email",
    body: "Potvrďte túto adresu a dokončite zmenu emailu vo vašom účte Samuelsson Cuts.",
    cta: "Potvrdiť zmenu emailu",
  },
  email: {
    preview: "Overenie emailu pre Samuelsson Cuts",
    heading: "Overte email",
    body: "Kliknite na tlačidlo nižšie a overte emailovú adresu pre Samuelsson Cuts.",
    cta: "Overiť email",
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
      <Text className="mb-0 mt-5 text-xs leading-relaxed text-stone-500">
        Ak tlačidlo nefunguje, skopírujte tento odkaz do prehliadača:
        <br />
        <Link href={confirmUrl} className="break-all text-xs text-stone-500 underline">
          {confirmUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}
