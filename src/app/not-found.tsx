import { ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const t = await getDict();
  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl p-6 text-center">
        <p className="text-5xl font-semibold text-black dark:text-white">404</p>
        <h1 className="mt-4 text-xl font-semibold text-black dark:text-white">
          {t.errors.notFoundTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {t.errors.notFoundBody}
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/">{t.errors.goHome}</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
