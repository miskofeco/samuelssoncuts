"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  cancelConfirmedAppointmentAction,
  requestRescheduleAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById } from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  ClientAppointment,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

import { SlotPicker, type SlotChoice } from "./slot-picker";

// Client self-service over confirmed appointments (cancel + request-reschedule),
// gated on the 24h lead-time flag computed server-side (canModify).
export function UpcomingAppointments({
  appointments,
  services,
  bookedSlots,
  pendingRequests,
  blockedDates,
}: {
  appointments: ClientAppointment[];
  services: Service[];
  // Confirmed slots (from confirmed_appointment_slots) shaped for the picker.
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  if (appointments.length === 0) return null;

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader title={t.client.upcomingTitle} />
      <div className="mt-4 space-y-3">
        {appointments.map((appointment) => (
          <UpcomingCard
            key={appointment.id}
            appointment={appointment}
            services={services}
            bookedSlots={bookedSlots}
            pendingRequests={pendingRequests}
            blockedDates={blockedDates}
          />
        ))}
      </div>
    </Card>
  );
}

function UpcomingCard({
  appointment,
  services,
  bookedSlots,
  pendingRequests,
  blockedDates,
}: {
  appointment: ClientAppointment;
  services: Service[];
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const service = serviceById(appointment.serviceId, services);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotChoice | null>(null);

  function cancel() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await cancelConfirmedAppointmentAction(appointment.id);
        setFeedback(result);
        if (result.ok) setConfirmingCancel(false);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function submitReschedule() {
    if (!date || !slot) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await requestRescheduleAction(appointment.id, date, slot.time);
        setFeedback(result);
        if (result.ok) {
          setRescheduling(false);
          setDate(null);
          setSlot(null);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-black dark:text-white">{service.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-emerald-900 dark:text-emerald-200">
            {formatFullDay(appointment.date, locale)} · {appointment.time}
          </p>
          <Link
            href={`/client/reservations/${appointment.id}`}
            className="mt-1 inline-block text-xs font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300"
          >
            {t.client.detailTitle}
          </Link>
        </div>
        <StatusPill tone="success">{t.client.upcomingConfirmed}</StatusPill>
      </div>

      <Feedback result={feedback} className="mt-3" />

      {appointment.canModify ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setRescheduling(true)}
          >
            {t.client.rescheduleAppointment}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            {t.client.cancelAppointment}
          </Button>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
          {t.client.lockedNotice}
        </p>
      )}

      {/* Cancel confirmation */}
      <Modal
        open={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        title={t.client.confirmCancelTitle}
        description={t.client.confirmCancelBody}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirmingCancel(false)}
          >
            {t.client.keepAppointment}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={cancel}
          >
            {pending ? t.common.working : t.client.cancelAppointment}
          </Button>
        </div>
      </Modal>

      {/* Reschedule picker */}
      <Modal
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        title={t.client.rescheduleTitle}
        description={t.client.rescheduleDescription}
      >
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
          appointments={bookedSlots}
          pendingRequests={pendingRequests}
          blockedDates={blockedDates}
        />
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={!date || !slot || pending}
            onClick={submitReschedule}
          >
            {pending ? t.common.sending : t.client.rescheduleSubmit}
          </Button>
        </div>
      </Modal>
    </article>
  );
}
