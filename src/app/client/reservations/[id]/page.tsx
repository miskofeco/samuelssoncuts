import Link from "next/link";
import { notFound } from "next/navigation";

import { buildCalendarLinks } from "@/emails/calendar-links";
import { ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay } from "@/domain/schedule";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { getShopAddress, getShopMapUrl, getShopPhone } from "@/lib/env";
import { requireApprovedClient } from "@/server/auth";
import { loadClientAppointmentDetail } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireApprovedClient();
  const { id } = await params;
  const appt = await loadClientAppointmentDetail(profile, id);
  if (!appt) notFound();

  const t = await getDict();
  const locale = localeFor(await getLang());
  const address = getShopAddress();
  const mapUrl = getShopMapUrl();
  const phone = getShopPhone();
  const calendar = buildCalendarLinks({
    appointmentId: appt.id,
    service: appt.serviceName,
    startIso: appt.startIso,
    endIso: appt.endIso,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t.client.detailEyebrow} title={t.client.detailTitle} />

      <Link
        href="/client/reservations"
        className="inline-block text-sm font-semibold text-stone-500 underline underline-offset-4 hover:text-black dark:text-stone-400 dark:hover:text-white"
      >
        ← {t.client.detailBack}
      </Link>

      <Card className="rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            {appt.serviceName}
          </h2>
          <StatusPill tone={appt.status === "confirmed" ? "success" : "neutral"}>
            {appt.status}
          </StatusPill>
        </div>

        <dl className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          <Row label={t.client.detailWhen}>
            {formatFullDay(appt.date, locale)} · {appt.time}
          </Row>
          <Row label={t.client.detailService}>{appt.serviceName}</Row>
          <Row label={t.client.detailDuration}>{appt.serviceDuration} min</Row>
          {appt.priceCents != null ? (
            <Row label={t.client.detailPrice}>
              {Math.round(appt.priceCents / 100)} €
              {appt.surcharge ? (
                <span className="mt-0.5 block text-xs font-normal text-amber-700 dark:text-amber-400">
                  {t.client.detailSurchargeNote}
                </span>
              ) : null}
            </Row>
          ) : null}
          {address ? (
            <Row label={t.client.detailLocation}>
              {address}
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block text-xs font-semibold text-sky-700 underline underline-offset-4 dark:text-sky-400"
                >
                  {t.client.detailOpenMap}
                </a>
              ) : null}
            </Row>
          ) : null}
          {phone ? (
            <Row label={t.client.detailContact}>
              <a href={`tel:${phone}`} className="underline underline-offset-4">
                {phone}
              </a>
            </Row>
          ) : null}
        </dl>

        {appt.status === "confirmed" ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {t.client.detailAddToCalendar}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ButtonLink href={calendar.google} variant="secondary" target="_blank" rel="noreferrer">
                {t.client.detailGoogleCal}
              </ButtonLink>
              <ButtonLink href={calendar.apple} variant="secondary">
                {t.client.detailAppleCal}
              </ButtonLink>
            </div>
          </div>
        ) : null}

        <p className="mt-5 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
          {t.client.detailCancellationPolicy}
        </p>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-sm text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="text-right text-sm font-semibold text-black dark:text-white">{children}</dd>
    </div>
  );
}
