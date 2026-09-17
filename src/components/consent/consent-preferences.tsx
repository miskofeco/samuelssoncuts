"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import { Toggle } from "@/components/shared/toggle";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { CONSENT_LAST_UPDATED, CONSENT_VERSION, OPTIONAL_CATEGORIES } from "@/lib/consent/config";

import { useConsent, type OptionalChoices } from "./consent-provider";

// Granular preferences modal. Opens from the banner's "Manage preferences", the
// sidebar, and the settings/profile pages — the single place to review and
// change every category. Necessary is always-on and cannot be toggled.
export function ConsentPreferences() {
  const t = useT();
  const lang = useLang();
  const { modalOpen, closePreferences, state, acceptAll, rejectAll, save } = useConsent();

  // Local edits live here (not in the body) so the Save button can sit in the
  // modal's sticky footer. `null` means "not touched yet": the switches then
  // mirror the saved decision, and every close path resets to null so the next
  // open re-seeds from the latest saved choice.
  const [draft, setDraft] = useState<OptionalChoices | null>(null);
  const choices: OptionalChoices = draft ?? {
    functional: state?.functional ?? false,
    analytics: state?.analytics ?? false,
    marketing: state?.marketing ?? false,
  };

  function set(key: keyof OptionalChoices, next: boolean) {
    setDraft({ ...choices, [key]: next });
  }

  function close() {
    setDraft(null);
    closePreferences();
  }

  function handleRejectAll() {
    setDraft(null);
    rejectAll();
  }

  function handleAcceptAll() {
    setDraft(null);
    acceptAll();
  }

  function handleSave() {
    const next = choices;
    setDraft(null);
    save(next);
  }

  const lastUpdated = t.consent.modal.lastUpdated(
    new Intl.DateTimeFormat(localeFor(lang), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(CONSENT_LAST_UPDATED)),
  );

  return (
    <Modal
      open={modalOpen}
      onClose={close}
      title={t.consent.modal.title}
      description={t.consent.modal.intro}
      size="md"
      footer={
        <>
          <Button variant="outline" size="lg" onClick={handleRejectAll} className="sm:h-10 sm:text-sm">
            {t.consent.modal.rejectAll}
          </Button>
          <Button variant="outline" size="lg" onClick={handleAcceptAll} className="sm:h-10 sm:text-sm">
            {t.consent.modal.acceptAll}
          </Button>
          <Button size="lg" onClick={handleSave} className="sm:h-10 sm:text-sm">
            {t.consent.modal.save}
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {/* Necessary — always on, cannot be disabled. */}
        <CategoryRow
          name={t.consent.categories.necessary.name}
          description={t.consent.categories.necessary.description}
          cookies={t.consent.categories.necessary.cookies}
          status={t.consent.categories.necessary.status}
          control={
            <div className="flex items-center gap-2">
              <StatusPill tone="success" className="hidden sm:inline-flex">
                {t.consent.modal.alwaysOn}
              </StatusPill>
              <Toggle checked disabled size="md" label={t.consent.categories.necessary.name} />
            </div>
          }
          note={<span className="sm:hidden">{t.consent.modal.alwaysOn}</span>}
        />

        {OPTIONAL_CATEGORIES.map((key) => (
          <CategoryRow
            key={key}
            name={t.consent.categories[key].name}
            description={t.consent.categories[key].description}
            cookies={t.consent.categories[key].cookies}
            status={t.consent.categories[key].status}
            control={
              <Toggle
                checked={choices[key]}
                onChange={(next) => set(key, next)}
                size="md"
                label={t.consent.categories[key].name}
              />
            }
          />
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{t.consent.modal.version(CONSENT_VERSION)}</span>
          <span aria-hidden>·</span>
          <span>{lastUpdated}</span>
        </div>
        <Link
          href="/cookies"
          onClick={close}
          className="inline-flex min-h-8 items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline"
        >
          {t.consent.modal.policyLink}
          <Icon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </div>
    </Modal>
  );
}

function CategoryRow({
  name,
  description,
  cookies,
  status,
  control,
  note,
}: {
  name: string;
  description: string;
  cookies: string;
  status: string;
  control: ReactNode;
  /** Optional small print next to the status line (e.g. "Always on" on phones). */
  note?: ReactNode;
}) {
  const t = useT();
  return (
    <li className="rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0 pt-0.5">{control}</div>
      </div>
      <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground/80">{t.consent.modal.cookiesUsedLabel}:</span> {cookies}
        </p>
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="italic">{status}</span>
          {note ? <span className="font-semibold text-foreground/80">{note}</span> : null}
        </p>
      </div>
    </li>
  );
}
