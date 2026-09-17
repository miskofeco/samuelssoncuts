"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import { createRequestFromClientAction } from "@/app/actions";
import { Button, ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { TextAreaField } from "@/components/shared/form";
import { toast } from "@/components/shared/toaster";
import {
  defaultClientServiceId,
  defaultServiceImage,
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

import { SlotPicker, type SlotChoice } from "./slot-picker";

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
      <Card
        role="status"
        className="rounded-2xl p-5 sm:p-7"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <h2 className="text-xl font-semibold text-black dark:text-white">
              {t.client.bookingSuccessTitle}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {t.client.bookingSuccessDescription}
            </p>
          </div>
        </div>

        <span className="mt-5 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
          {t.client.awaitingConfirmation}
        </span>

        <dl className="mt-5 grid gap-3 rounded-xl bg-stone-50 p-4 text-sm dark:bg-stone-800/70 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">{t.client.service}</dt>
            <dd className="mt-0.5 font-semibold text-black dark:text-white">{success.service}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">{t.client.pickDate}</dt>
            <dd className="mt-0.5 font-semibold text-black dark:text-white">{formattedDate}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">{t.client.chosenTime}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-black dark:text-white">{success.time}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">{t.client.priceLabel}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-black dark:text-white">{success.price} €</dd>
          </div>
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

  return (
    <Card className="-mx-4 !rounded-none !border-0 !bg-transparent !p-0 !shadow-none sm:mx-0 sm:!rounded-2xl sm:!border sm:!border-black/10 sm:!bg-white sm:!p-5 sm:!shadow-[0_18px_70px_rgba(0,0,0,0.06)] dark:sm:!border-white/10 dark:sm:!bg-stone-900 dark:sm:!shadow-[0_18px_70px_rgba(0,0,0,0.4)]">
      <form onSubmit={onSubmit}>
        <div className="px-4 sm:px-0">
          <SectionHeader
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
                    "flex min-h-20 flex-row overflow-hidden rounded-xl border bg-white text-left transition active:scale-[0.99] hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:flex-col md:flex-row dark:bg-stone-900 dark:focus-visible:ring-white",
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-500 dark:border-emerald-400 dark:ring-emerald-400"
                      : "border-black/10 dark:border-white/10",
                  )}
                >
                  <span className="relative block h-16 w-16 shrink-0 sm:h-36 sm:w-full md:h-auto md:min-h-32 md:w-32 md:shrink-0 lg:w-28">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 64px, (max-width: 768px) 100vw, 128px"
                      unoptimized={imageSrc.startsWith("http")}
                      className="object-cover"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col p-3">
                    <span className="block truncate text-sm font-semibold text-black dark:text-white">
                      {service.name}
                    </span>
                    {service.description ? (
                      <span className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500 dark:text-stone-400">
                        {service.description}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">
                      {service.duration} min · {service.price} €
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {serviceId ? (
          <div className="mt-4">
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
          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
            {t.client.chooseServiceFirst}
          </p>
        )}

        <TextAreaField
          label={t.client.notes}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.client.notesPlaceholder}
          className="mx-4 mt-4 sm:mx-0"
        />

        <Feedback result={feedback} className="mx-4 mt-4 sm:mx-0" />

        <div className="sticky bottom-0 z-20 mt-4 flex flex-col gap-3 border-t border-black/10 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none dark:border-white/10 dark:bg-stone-950/95 dark:sm:bg-transparent">
          {slot ? (
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              {t.client.youPayPrefix}:{" "}
              <span className="ml-3 text-2xl font-bold tabular-nums text-black dark:text-white">
                {slot.price} €
              </span>
              <span className="ml-2 text-sm font-medium text-stone-500 dark:text-stone-400">
                {priceCalculation ? `(${priceCalculation})` : null}
              </span>
            </p>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            disabled={!serviceId || !date || !slot || pending}
            className="w-full sm:w-auto"
          >
            {pending
              ? t.common.sending
              : serviceId
                ? t.client.sendRequest
                : t.client.noServices}
          </Button>
        </div>
      </form>
    </Card>
  );
}
