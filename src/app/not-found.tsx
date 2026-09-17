import { Home01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Icon } from "@/components/shared/icon";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const t = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-8">
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-2xl bg-muted text-foreground ring-1 ring-foreground/10 [&_svg:not([class*='size-'])]:size-7"
            >
              <Icon icon={Search01Icon} />
            </EmptyMedia>
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase tabular-nums">
              404
            </p>
            <EmptyTitle className="text-xl font-semibold tracking-tight text-foreground">
              {t.errors.notFoundTitle}
            </EmptyTitle>
            <EmptyDescription className="leading-6">{t.errors.notFoundBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-2 *:w-full sm:*:w-auto">
            <ButtonLink href="/" size="lg">
              <Icon icon={Home01Icon} />
              {t.errors.goHome}
            </ButtonLink>
          </EmptyContent>
        </Empty>
      </Card>
    </main>
  );
}
