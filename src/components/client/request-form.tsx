"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";

import { createRequestFromClientAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { TextAreaField } from "@/components/shared/form";
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
import { useT } from "@/i18n/provider";
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
  const orderedServices = orderClientServices(services);
  const [serviceId, setServiceId] = useState(
    initialServiceId ?? defaultClientServiceId(services),
  );
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotChoice | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

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
        setFeedback(result);
        if (result.ok) {
          setNote("");
          setSlot(null);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
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
                    "flex flex-col overflow-hidden rounded-xl border bg-white text-left transition hover:border-emerald-500 md:flex-row dark:bg-stone-900",
                    selected
                      ? "border-emerald-500 ring-2 ring-emerald-500 dark:border-emerald-400 dark:ring-emerald-400"
                      : "border-black/10 dark:border-white/10",
                  )}
                >
                  <span className="relative block h-36 w-full md:h-auto md:min-h-32 md:w-32 md:shrink-0 lg:w-28">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 128px"
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

        <div className="mx-4 mt-4 flex flex-col gap-3 sm:mx-0 sm:flex-row sm:items-center sm:justify-between">
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
