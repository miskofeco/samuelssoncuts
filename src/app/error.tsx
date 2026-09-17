"use client";

import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useEffect } from "react";

import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Icon } from "@/components/shared/icon";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useT } from "@/i18n/provider";

// Route-segment error boundary. Renders inside the root layout, so the i18n and
// theme providers are available. Never expose `error.message` to the user — it
// can leak internal detail; log it to the console for diagnostics instead.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error("[route-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-8">
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-2xl bg-destructive/10 text-destructive ring-1 ring-foreground/10 dark:bg-destructive/20 [&_svg:not([class*='size-'])]:size-7"
            >
              <Icon icon={Alert02Icon} />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-semibold tracking-tight text-foreground">
              {t.errors.genericTitle}
            </EmptyTitle>
            <EmptyDescription className="leading-6">{t.errors.genericBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-2 *:w-full sm:*:w-auto">
            <Button type="button" size="lg" onClick={reset}>
              <Icon icon={RefreshIcon} />
              {t.errors.retry}
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </main>
  );
}
