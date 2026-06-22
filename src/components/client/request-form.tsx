"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { createRequestFromClientAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { SelectField, TextAreaField } from "@/components/shared/form";
import { serviceById } from "@/domain/schedule";
import type { ActionResult, Appointment, BookingRequest, Service } from "@/domain/types";
import { useT } from "@/i18n/provider";

import { SlotPicker, type SlotChoice } from "./slot-picker";

export function RequestForm({
  services,
  appointments,
  pendingRequests,
  blockedDates,
}: {
  services: Service[];
  appointments: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
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
      const result = await createRequestFromClientAction(serviceId, date, slot.time, note);
      setFeedback(result);
      if (result.ok) {
        setNote("");
        setSlot(null);
      }
    });
  }

  return (
    <Card className="rounded-2xl p-3 sm:p-5">
      <form onSubmit={onSubmit}>
        <SectionHeader
          eyebrow={t.client.newAppointment}
          title={t.client.pickTime}
          action={
            <SelectField
              aria-label={t.client.service}
              label={t.client.service}
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setSlot(null);
              }}
              className="min-w-55"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {service.duration} min · {service.price} €
                </option>
              ))}
            </SelectField>
          }
        />

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
