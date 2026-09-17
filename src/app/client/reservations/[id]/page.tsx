import {
  AppleIcon,
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Call02Icon,
  EuroIcon,
  GoogleIcon,
  InformationCircleIcon,
  Location01Icon,
  Scissor01Icon,
  Time01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildCalendarLinks } from "@/emails/calendar-links";
import { ConfirmedAppointmentActions } from "@/components/client/confirmed-appointment-actions";
import { ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Icon, type IconSource } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay } from "@/domain/schedule";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { getShopAddress, getShopMapUrl, getShopPhone } from "@/lib/env";
import { cn } from "@/lib/classnames";
import { requireApprovedClient } from "@/server/auth";
import { loadBookingData, loadClientAppointmentDetail } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireApprovedClient();
  const { id } = await params;
  const [appt, bookingData] = await Promise.all([
    loadClientAppointmentDetail(profile, id),
    loadBookingData(),
  ]);
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
  const service = bookingData.services.find((item) => item.id === appt.serviceId) ?? {
    id: appt.serviceId,
    name: appt.serviceName,
    duration: appt.serviceDuration,
    price: Math.round((appt.priceCents ?? 0) / 100),
  };
  const confirmed = appt.status === "confirmed";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t.client.detailEyebrow} title={t.client.detailTitle} />

      <Link
        href="/client/reservations"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
        {t.client.detailBack}
      </Link>

      <Card className="rounded-2xl">
        {/* Header: service + status */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              confirmed
                ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive",
            )}
          >
            <Icon icon={Scissor01Icon} className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {appt.serviceName}
              </h2>
              <StatusPill tone={confirmed ? "success" : "danger"} dot className="shrink-0">
                {confirmed ? t.statuses.confirmed : t.statuses.cancelled}
              </StatusPill>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {formatFullDay(appt.date, locale)} · {appt.time}
            </p>
          </div>
        </div>

        <dl className="mt-5 divide-y">
          <Row icon={Calendar03Icon} label={t.client.detailWhen}>
            <span className="tabular-nums">
              {formatFullDay(appt.date, locale)} · {appt.time}
            </span>
          </Row>
          <Row icon={Scissor01Icon} label={t.client.detailService}>
            {appt.serviceName}
          </Row>
          <Row icon={Time01Icon} label={t.client.detailDuration}>
            <span className="tabular-nums">{appt.serviceDuration} min</span>
          </Row>
          {appt.priceCents != null ? (
            <Row icon={EuroIcon} label={t.client.detailPrice}>
              <span className="tabular-nums">{Math.round(appt.priceCents / 100)} €</span>
              {appt.surcharge ? (
                <span className="mt-0.5 block text-xs font-normal text-amber-700 dark:text-amber-400">
                  {t.client.detailSurchargeNote}
                </span>
              ) : null}
            </Row>
          ) : null}
          {address ? (
            <Row icon={Location01Icon} label={t.client.detailLocation}>
              {address}
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-sky-700 underline underline-offset-4 dark:text-sky-400"
                >
                  {t.client.detailOpenMap}
                  <Icon icon={ArrowUpRight01Icon} className="size-3.5" strokeWidth={2} />
                </a>
              ) : null}
            </Row>
          ) : null}
          {phone ? (
            <Row icon={Call02Icon} label={t.client.detailContact}>
              <a
                href={`tel:${phone}`}
                className="inline-flex min-h-8 items-center underline underline-offset-4 tabular-nums"
              >
                {phone}
              </a>
            </Row>
          ) : null}
        </dl>

        {confirmed ? (
          <div className="mt-5">
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t.client.detailAddToCalendar}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <ButtonLink href={calendar.google} variant="secondary" target="_blank" rel="noreferrer">
                <Icon icon={GoogleIcon} className="size-4" strokeWidth={2} />
                {t.client.detailGoogleCal}
              </ButtonLink>
              <ButtonLink href={calendar.apple} variant="secondary">
                <Icon icon={AppleIcon} className="size-4" strokeWidth={2} />
                {t.client.detailAppleCal}
              </ButtonLink>
            </div>
          </div>
        ) : null}

        {confirmed ? (
          <ConfirmedAppointmentActions
            appointment={{
              id: appt.id,
              serviceId: appt.serviceId,
              date: appt.date,
              time: appt.time,
              canModify: appt.canModify,
            }}
            service={service}
            services={bookingData.services}
            pricingSettings={bookingData.pricingSettings}
            bookedSlots={bookingData.appointments}
            pendingRequests={bookingData.pendingRequests}
            blockedDates={bookingData.blockedDates}
            businessHours={bookingData.businessHours}
          />
        ) : null}

        <p className="mt-5 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Icon icon={InformationCircleIcon} className="mt-px size-3.5" />
          <span>{t.client.detailCancellationPolicy}</span>
        </p>
      </Card>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: IconSource;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon={icon} className="size-4" />
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}
