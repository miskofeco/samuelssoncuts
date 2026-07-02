"use client";

import { useEffect } from "react";

import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
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
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl p-6 text-center">
        <h1 className="text-xl font-semibold text-black dark:text-white">
          {t.errors.genericTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {t.errors.genericBody}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" onClick={reset}>
            {t.errors.retry}
          </Button>
        </div>
      </Card>
    </main>
  );
}
