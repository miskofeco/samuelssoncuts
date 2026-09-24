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
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";

import { createRequestFromClientAction } from "@/app/actions";
import { Button, ButtonLink } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Badge } from "@/components/ui/badge";
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
  servicePriceForDate,
} from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BlockedInterval,
  BookingRequest,
  BusinessHoursDay,
  PricingSettings,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
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
  blockedIntervals,
  businessHours,
  initialServiceId,
}: {
  services: Service[];
  pricingSettings: PricingSettings;
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  blockedIntervals: BlockedInterval[];
  businessHours: BusinessHoursDay[];
  /** Preselected service for one-tap rebooking (?service=<id>). */
  initialServiceId?: string;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const initialAvailability = useMemo(() => ({
    appointments,
    pendingRequests,
    blockedDates: [...blockedDates],
    blockedIntervals,
    businessHours,
    pricingSettings,
  }), [appointments, pendingRequests, blockedDates, blockedIntervals, businessHours, pricingSettings]);
  const { data: availability, refresh: refreshAvailability } = useLiveSnapshot(
    initialAvailability,
    "/api/client/booking-availability",
    8000,
  );
  const liveBlockedDates = useMemo(
    () => new Set(availability.blockedDates),
    [availability.blockedDates],
  );
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
  const basePrice = servicePriceForDate(service, date);
  const priceCalculation = slot
    ? slot.priceKind === "vip"
      ? `${basePrice} € + ${availability.pricingSettings.vipSurchargePercent}%`
      : slot.priceKind === "gap"
        ? `${basePrice} € + ${availability.pricingSettings.gapSurchargePercent}%`
        : `${basePrice} €`
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
          refreshAvailability();
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

  // Summary + CTA block. Rendered once in the card's third column on desktop
  // and once as a sticky bar above the phone tab bar; both submit the form.
  const summary = (
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
              {!hasService ? t.client.chooseServiceFirst : date ? t.client.pickTime : t.client.pickDate}
            </span>
          </p>
        )}
      </div>
    </div>
  );

  const submitButton = (
    <Button
      type="submit"
      size="lg"
      disabled={!serviceId || !date || !slot}
      loading={pending}
      className="shrink-0 lg:w-full"
    >
      {pending ? t.common.sending : serviceId ? t.client.sendRequest : t.client.noServices}
    </Button>
  );

  const noteField = (
    <TextAreaField
      label={t.client.notes}
      value={note}
      onChange={(event) => setNote(event.target.value)}
      placeholder={t.client.notesPlaceholder}
      rows={4}
      className="mt-3 [&_[data-slot=field-label]]:sr-only lg:flex-1 lg:[&_textarea]:min-h-44"
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Step 1: service — outside the booking card, as a compact chooser. */}
      <section>
        <StepHeader step={1} eyebrow={t.client.newAppointment} title={t.client.chooseService} />
        {orderedServices.length > 0 ? (
          <div role="radiogroup" aria-label={t.client.chooseService} className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {orderedServices.map((service) => {
              const selected = service.id === serviceId;
              const imageSrc = defaultServiceImage(service);
              return (
                <button
                  key={service.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setServiceId(service.id);
                    setSlot(null);
                  }}
                  className={cn(
                    "relative grid min-h-20 min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border bg-card p-3 text-left shadow-xs transition outline-none active:scale-[0.99] hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/50 xl:flex xl:gap-3.5",
                    selected && "border-primary bg-primary/5 ring-2 ring-primary/25 hover:border-primary",
                  )}
                >
                  <span className="relative row-span-2 block size-12 shrink-0 self-start overflow-hidden rounded-lg xl:size-14 xl:self-center">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 56px, 48px"
                      className="object-cover"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[0.95rem] font-semibold text-foreground">{service.name}</span>
                      {selected ? (
                        <Icon icon={Tick02Icon} className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                      ) : null}
                    </span>
                    {service.description ? (
                      <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{service.description}</span>
                    ) : null}
                  </span>
                  <Badge variant={selected ? "default" : "secondary"} className="col-start-2 w-fit shrink-0 tabular-nums">
                    {service.duration} {t.admin.minutesShort} · {service.price} €
                    {service.sundayPrice !== service.price
                      ? ` · ${t.admin.sundayPriceLabel(service.sundayPrice)}`
                      : null}
                  </Badge>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Steps 2–4 live in one card: date → time → confirm. */}
      {hasService ? (
        <SlotPicker
          service={service}
          services={services}
          pricingSettings={availability.pricingSettings}
          date={date}
          onDateChange={(next) => {
            setDate(next);
            setSlot(null);
          }}
          selectedTime={slot?.time ?? null}
          selectedChoice={slot}
          onSelectTime={setSlot}
          onInvalidSelection={() => {
            setSlot(null);
            setFeedback({ ok: false, error: t.feedback.slotTaken });
          }}
          appointments={availability.appointments}
          pendingRequests={availability.pendingRequests}
          blockedDates={liveBlockedDates}
          blockedIntervals={availability.blockedIntervals}
          businessHours={availability.businessHours}
          steps={{ date: 2, time: 3 }}
          aside={
            <>
              <p className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                <StepBadge step={4} />
                <span className="flex items-center gap-1.5">
                  {t.client.notes}
                  <span className="font-normal text-muted-foreground">{t.common.optional}</span>
                </span>
              </p>
              {noteField}

              {slot?.priceKind === "gap" ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
                  {t.client.surchargeWarning(availability.pricingSettings.gapSurchargePercent)}
                </p>
              ) : null}
              {slot?.priceKind === "vip" ? (
                <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:bg-sky-500/10 dark:text-sky-200">
                  {t.client.vipWarning}
                </p>
              ) : null}

              <Feedback result={feedback} className="mt-3" />

              {/* Desktop checkout: summary + CTA pinned to the column's bottom. */}
              <div className="mt-auto hidden flex-col gap-3 border-t pt-4 lg:flex">
                <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {t.client.summary}
                </p>
                {summary}
                {submitButton}
              </div>
            </>
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t.client.chooseServiceFirst}</p>
      )}

      {/* Phone / tablet: sticky summary + CTA above the tab bar. */}
      <div className="sticky bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 pt-3 pb-3 backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border sm:px-4 md:bottom-4 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          {summary}
          {submitButton}
        </div>
      </div>
    </form>
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
