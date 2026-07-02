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
import type { ActionResult, Appointment, BookingRequest, Service } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

import { SlotPicker, type SlotChoice } from "./slot-picker";

export function RequestForm({
  services,
  appointments,
  pendingRequests,
  blockedDates,
  initialServiceId,
}: {
  services: Service[];
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
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
    <Card className="rounded-2xl p-3 sm:p-5">
      <form onSubmit={onSubmit}>
        <SectionHeader
          eyebrow={t.client.newAppointment}
          title={t.client.chooseService}
        />

        {orderedServices.length > 0 ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
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
            />

            {/* Surcharge warning when the chosen slot leaves a gap. */}
            {slot?.surcharge ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
                {t.client.surchargeWarning}
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
          className="mt-4"
        />

        <Feedback result={feedback} className="mt-4" />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {slot ? (
            <p className="text-sm font-medium text-black dark:text-white">
              {t.client.youPay(`${slot.price} €`)}
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
