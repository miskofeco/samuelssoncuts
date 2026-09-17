"use client";

import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Note01Icon,
  Scissor01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";

import { createRequestFromClientAction } from "@/app/actions";
import { Button, ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { TextAreaField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { toast } from "@/components/shared/toaster";
import {
  defaultClientServiceId,
  defaultServiceImage,
  formatFullDay,
  orderClientServices,
  serviceById,
} from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  BusinessHoursDay,
  PricingSettings,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

import { SlotPicker, StepBadge, type SlotChoice } from "./slot-picker";

/** Section heading of the booking stepper: numbered badge + title. */
function StepHeader({
  step,
  title,
  description,
  eyebrow,
}: {
  step: number;
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <div className="min-w-0">
      {eyebrow ? (
        <p className="mb-1 text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        <StepBadge step={step} />
        <span className="min-w-0">{title}</span>
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function RequestForm({
  services,
  pricingSettings,
  appointments,
  pendingRequests,
  blockedDates,
  businessHours,
  initialServiceId,
}: {
  services: Service[];
  pricingSettings: PricingSettings;
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  businessHours: BusinessHoursDay[];
  /** Preselected service for one-tap rebooking (?service=<id>). */
  initialServiceId?: string;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const orderedServices = orderClientServices(services);
  const [serviceId, setServiceId] = useState(
    initialServiceId ?? defaultClientServiceId(services),
  );
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotChoice | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [success, setSuccess] = useState<{
    service: string;
    date: string;
    time: string;
    price: number;
  } | null>(null);

  const service = serviceById(serviceId, services);
  const priceCalculation = slot
    ? slot.priceKind === "vip"
      ? `${service.price} € + ${pricingSettings.vipSurchargePercent}%`
      : slot.priceKind === "gap"
        ? `${service.price} € + ${pricingSettings.gapSurchargePercent}%`
        : `${service.price} €`
    : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || !slot) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await createRequestFromClientAction(serviceId, date, slot.time, note);
        if (result.ok) {
          setSuccess({ service: service.name, date, time: slot.time, price: slot.price });
          setFeedback(null);
          toast.success(result.message ?? t.client.bookingSuccessTitle);
        } else {
          setFeedback(result);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  if (success) {
    const formattedDate = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${success.date}T12:00:00`));

    return (
      <Card role="status" className="rounded-2xl sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
            <Icon icon={CheckmarkCircle02Icon} className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {t.client.bookingSuccessTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.client.bookingSuccessDescription}
            </p>
          </div>
        </div>

        <StatusPill tone="warning" dot className="mt-5">
          {t.client.awaitingConfirmation}
        </StatusPill>

        <dl className="mt-5 grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
          <SummaryRow label={t.client.service}>{success.service}</SummaryRow>
          <SummaryRow label={t.client.pickDate}>{formattedDate}</SummaryRow>
          <SummaryRow label={t.client.chosenTime}>
            <span className="tabular-nums">{success.time}</span>
          </SummaryRow>
          <SummaryRow label={t.client.priceLabel}>
            <span className="tabular-nums">{success.price} €</span>
          </SummaryRow>
        </dl>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/client/reservations" size="lg">
            {t.client.viewReservations}
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={() => setSuccess(null)}>
            {t.client.bookAnother}
          </Button>
        </div>
      </Card>
    );
  }

  const hasService = Boolean(serviceId);

  return (
    <Card className="-mx-4 !rounded-none !border-0 !bg-transparent !p-0 !shadow-none sm:mx-0 sm:!rounded-2xl sm:!border sm:!bg-card sm:!p-5 sm:!shadow-xs">
      <form onSubmit={onSubmit}>
        {/* Step 1: service */}
        <div className="px-4 sm:px-0">
          <StepHeader
            step={1}
            eyebrow={t.client.newAppointment}
            title={t.client.chooseService}
          />
        </div>

        {orderedServices.length > 0 ? (
          <div className="mt-4 grid gap-3 px-4 sm:gap-2 sm:px-0 lg:grid-cols-3">
            {orderedServices.map((service) => {
              const selected = service.id === serviceId;
              const imageSrc = defaultServiceImage(service);
              return (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setServiceId(service.id);
                    setSlot(null);
                  }}
                  className={cn(
                    "relative flex min-h-20 flex-row overflow-hidden rounded-xl border bg-card text-left transition outline-none active:scale-[0.99] hover:border-emerald-500 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-col md:flex-row",
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-500 dark:border-emerald-400 dark:ring-emerald-400"
                      : "border-border",
                  )}
                >
                  <span className="relative block h-20 w-20 shrink-0 sm:h-36 sm:w-full md:h-auto md:min-h-32 md:w-32 md:shrink-0 lg:w-28">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 80px, (max-width: 768px) 100vw, 128px"
                      unoptimized={imageSrc.startsWith("http")}
                      className="object-cover"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center p-3">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {service.name}
                    </span>
                    {service.description ? (
                      <span className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {service.description}
                      </span>
                    ) : null}
                    <span className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Icon icon={Clock01Icon} className="size-3.5" />
                      {service.duration} min · {service.price} €
                    </span>
                  </span>
                  {selected ? (
                    <span
                      aria-hidden
                      className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs"
                    >
                      <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Steps 2 + 3: date and time */}
        {hasService ? (
          <div className="mt-6">
            <SlotPicker
              service={service}
              services={services}
              pricingSettings={pricingSettings}
              date={date}
              onDateChange={(next) => {
                setDate(next);
                setSlot(null);
              }}
              selectedTime={slot?.time ?? null}
              onSelectTime={setSlot}
              appointments={appointments}
              pendingRequests={pendingRequests}
              blockedDates={blockedDates}
              businessHours={businessHours}
              steps={{ date: 2, time: 3 }}
            />

            {slot?.priceKind === "gap" ? (
              <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-0 dark:bg-amber-500/10 dark:text-amber-300">
                {t.client.surchargeWarning(pricingSettings.gapSurchargePercent)}
              </p>
            ) : null}
            {slot?.priceKind === "vip" ? (
              <p className="mx-4 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950 sm:mx-0 dark:bg-sky-500/10 dark:text-sky-200">
                {t.client.vipWarning}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 px-4 text-sm text-muted-foreground sm:px-0">
            {t.client.chooseServiceFirst}
          </p>
        )}

        {/* Step 4: note */}
        <div className="mt-6 px-4 sm:px-0">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <StepBadge step={4} />
            <span className="flex items-center gap-1.5">
              {t.client.notes}
              <span className="font-normal text-muted-foreground">{t.common.optional}</span>
            </span>
          </p>
          <TextAreaField
            label={t.client.notes}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t.client.notesPlaceholder}
            className="mt-3 [&_[data-slot=field-label]]:sr-only"
          />
        </div>

        <Feedback result={feedback} className="mx-4 mt-4 sm:mx-0" />

        {/* Sticky summary + CTA. Sits above the phone tab bar; static from md. */}
        <div className="sticky bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] z-20 mt-4 border-t bg-background/95 px-4 pt-3 pb-3 backdrop-blur-xl sm:-mx-5 sm:-mb-5 sm:rounded-b-2xl sm:px-5 sm:pb-5 md:static md:mx-0 md:mt-6 md:mb-0 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:backdrop-blur-none">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {slot ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t.client.youPayPrefix}:{" "}
                    <span className="ml-3 text-2xl font-bold tabular-nums text-foreground">
                      {slot.price} €
                    </span>
                    <span className="ml-2 text-sm font-medium text-muted-foreground">
                      {priceCalculation ? `(${priceCalculation})` : null}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Icon icon={Scissor01Icon} className="size-3.5" />
                      <span className="max-w-[10rem] truncate">{service.name}</span>
                    </span>
                    {date ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon icon={Calendar03Icon} className="size-3.5" />
                        {formatFullDay(date, locale)} · {slot.time}
                      </span>
                    ) : null}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon icon={hasService ? (date ? Clock01Icon : Calendar03Icon) : Note01Icon} className="size-4" />
                  <span className="truncate">
                    {!hasService
                      ? t.client.chooseServiceFirst
                      : date
                        ? t.client.pickTime
                        : t.client.pickDate}
                  </span>
                </p>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!serviceId || !date || !slot}
              loading={pending}
              className="shrink-0"
            >
              {pending
                ? t.common.sending
                : serviceId
                  ? t.client.sendRequest
                  : t.client.noServices}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{children}</dd>
    </div>
  );
}
