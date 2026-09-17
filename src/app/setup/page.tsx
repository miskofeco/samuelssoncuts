import { Settings02Icon } from "@hugeicons/core-free-icons";

import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { getDict } from "@/i18n/server";

export default async function SetupPage() {
  const t = await getDict();
  return (
    <AuthFrame width="xl">
      <AuthHeading
        eyebrow={t.setup.eyebrow}
        title={t.setup.title}
        description={t.setup.description}
        illustration={<AuthIllustration icon={Settings02Icon} tone="warning" />}
      />
      <pre className="mt-6 overflow-x-auto rounded-xl bg-muted p-4 font-mono text-xs leading-6 text-foreground ring-1 ring-foreground/10 sm:text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
      </pre>
    </AuthFrame>
  );
}
