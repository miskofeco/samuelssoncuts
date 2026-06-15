"use client";

import { useState } from "react";

import { Modal } from "@/components/shared/modal";
import { Toggle } from "@/components/shared/toggle";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import {
  CONSENT_LAST_UPDATED,
  CONSENT_VERSION,
  OPTIONAL_CATEGORIES,
} from "@/lib/consent/config";
import { cn } from "@/lib/classnames";

import { useConsent, type OptionalChoices } from "./consent-provider";

// Granular preferences modal. Opens from the banner's "Manage preferences", the
// sidebar, and the settings/profile pages — the single place to review and
// change every category. Necessary is always-on and cannot be toggled.
export function ConsentPreferences() {
  const t = useT();
  const lang = useLang();
  const { modalOpen, closePreferences, state, acceptAll, rejectAll, save } =
    useConsent();

  return (
    <Modal
      open={modalOpen}
      onClose={closePreferences}
      title={t.consent.modal.title}
      className="sm:max-w-md"
    >
      {/* Remount the body each time the modal opens so the local toggle state
          re-seeds from the latest saved choice. */}
      {modalOpen ? (
        <PreferencesBody
          initial={{
            functional: state?.functional ?? false,
            analytics: state?.analytics ?? false,
            marketing: state?.marketing ?? false,
          }}
          onSave={save}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          lastUpdated={t.consent.modal.lastUpdated(
            new Intl.DateTimeFormat(localeFor(lang), {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date(CONSENT_LAST_UPDATED)),
          )}
          version={t.consent.modal.version(CONSENT_VERSION)}
        />
      ) : null}
    </Modal>
  );
}

function PreferencesBody({
  initial,
  onSave,
  onAcceptAll,
  onRejectAll,
  lastUpdated,
  version,
}: {
  initial: OptionalChoices;
  onSave: (choices: OptionalChoices) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  lastUpdated: string;
  version: string;
}) {
  const t = useT();
  const [choices, setChoices] = useState<OptionalChoices>(initial);

  function set(key: keyof OptionalChoices, next: boolean) {
    setChoices((prev) => ({ ...prev, [key]: next }));
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.7rem] leading-[1.15rem] text-stone-500 dark:text-stone-400">
        {t.consent.modal.intro}
      </p>

      <ul className="space-y-2">
        {/* Necessary — always on, cannot be disabled. */}
        <CategoryRow
          name={t.consent.categories.necessary.name}
          description={t.consent.categories.necessary.description}
          cookies={t.consent.categories.necessary.cookies}
          status={t.consent.categories.necessary.status}
          control={
            <div className="flex items-center gap-1.5">
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {t.consent.modal.alwaysOn}
              </span>
              <Toggle
                checked
                disabled
                size="sm"
                label={t.consent.categories.necessary.name}
              />
            </div>
          }
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
                size="sm"
                label={t.consent.categories[key].name}
              />
            }
          />
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-black/10 pt-2 text-[0.65rem] text-stone-400 dark:border-white/10 dark:text-stone-500">
        <span>{version}</span>
        <span>·</span>
        <span>{lastUpdated}</span>
      </div>

      <div className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <a
          href="/cookies"
          className="text-xs font-semibold text-black underline underline-offset-4 dark:text-white"
        >
          {t.consent.modal.policyLink}
        </a>
        <div className="flex flex-wrap gap-2">
          <FooterButton variant="secondary" onClick={onRejectAll}>
            {t.consent.modal.rejectAll}
          </FooterButton>
          <FooterButton variant="secondary" onClick={onAcceptAll}>
            {t.consent.modal.acceptAll}
          </FooterButton>
          <FooterButton variant="primary" onClick={() => onSave(choices)}>
            {t.consent.modal.save}
          </FooterButton>
        </div>
      </div>
    </div>
  );
}

// Compact footer buttons — the shared Button bakes in min-h-10/px-4/text-sm,
// which is too tall for this dense modal, so use smaller pills here.
function FooterButton({
  variant,
  onClick,
  children,
}: {
  variant: "primary" | "secondary";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:focus:ring-white dark:focus:ring-offset-stone-900",
        variant === "primary"
          ? "bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
          : "border border-stone-200 bg-white text-stone-950 hover:bg-stone-50 dark:border-white/15 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

function CategoryRow({
  name,
  description,
  cookies,
  status,
  control,
}: {
  name: string;
  description: string;
  cookies: string;
  status: string;
  control: React.ReactNode;
}) {
  const t = useT();
  return (
    <li className="rounded-lg border border-black/10 p-2.5 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-black dark:text-white">{name}</p>
          <p className="mt-0.5 text-[0.7rem] leading-[1.15rem] text-stone-600 dark:text-stone-400">
            {description}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">{control}</div>
      </div>
      <div className="mt-1.5 space-y-0.5 text-[0.65rem] leading-snug text-stone-500 dark:text-stone-400">
        <p>
          <span className="font-semibold">{t.consent.modal.cookiesUsedLabel}:</span>{" "}
          {cookies}
        </p>
        <p className="italic">{status}</p>
      </div>
    </li>
  );
}
